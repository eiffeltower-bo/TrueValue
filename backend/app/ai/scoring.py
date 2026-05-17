"""Deterministic lead scoring + LLM narrative layer.

Score is the sum of four 0-25 sub-scores (max 100). Bucket thresholds are
fixed (>=75 hot, >=50 warm, else cold). The LLM may shift the bucket by
at most one level — see prompts.LEAD_SCORING_SYSTEM.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from datetime import UTC, datetime

from app.ai.client import get_llm_client
from app.ai.prompts import LEAD_SCORING_SYSTEM, LEAD_SCORING_USER_TEMPLATE
from app.schemas.ai import Bucket, LeadScoreResponse, ScoreComponents
from app.tables.leads import Lead
from app.tables.properties import Property
from app.tables.showings import Showing


@dataclass
class _Components:
    completeness: int
    budget_realism: int
    engagement: int
    intent_clarity: int

    @property
    def total(self) -> int:
        return self.completeness + self.budget_realism + self.engagement + self.intent_clarity


def _bucket(score: int) -> Bucket:
    if score >= 75:
        return "hot"
    if score >= 50:
        return "warm"
    return "cold"


def _deterministic_components(
    lead: Lead, matching_inventory: int, showings: int, catalog_size: int
) -> _Components:
    # Completeness: full_name is required; the other four contact/intent
    # fields each contribute 5 points, plus 5 for having any contact channel.
    filled = 0
    filled += 5 if lead.phone else 0
    filled += 5 if lead.email else 0
    filled += 5 if lead.budget_min_usd and lead.budget_max_usd else 0
    filled += 5 if lead.zonas else 0
    filled += 5 if (lead.bedrooms_min or lead.area_min_m2 or lead.must_haves) else 0
    completeness = min(25, filled)

    # Budget realism: how much of the catalog falls inside the lead's range,
    # bucketed so a thin catalog still scores. With ~200 seed properties:
    # 0 matches → 0, 1-5 → 10, 6-15 → 18, 16+ → 25.
    if catalog_size == 0 or matching_inventory <= 0:
        budget_realism = 0
    elif matching_inventory <= 5:
        budget_realism = 10
    elif matching_inventory <= 15:
        budget_realism = 18
    else:
        budget_realism = 25

    # Engagement: #showings + recency. Each showing worth 8 pts (cap 16);
    # a lead created in the last 14 days adds 9, last 30 adds 5, older 0.
    showing_pts = min(16, showings * 8)
    age_days = (datetime.now(UTC) - lead.created_at).days if lead.created_at else 999
    if age_days <= 14:
        recency_pts = 9
    elif age_days <= 30:
        recency_pts = 5
    else:
        recency_pts = 0
    engagement = min(25, showing_pts + recency_pts)

    # Intent clarity: explicit intent + at least one specific filter signal.
    intent_pts = 10 if lead.intent in {"venta", "alquiler", "anticretico"} else 0
    intent_pts += 8 if lead.must_haves else 0
    intent_pts += 4 if lead.zonas else 0
    intent_pts += 3 if lead.notes and len(lead.notes) > 20 else 0
    intent_clarity = min(25, intent_pts)

    return _Components(
        completeness=completeness,
        budget_realism=budget_realism,
        engagement=engagement,
        intent_clarity=intent_clarity,
    )


def _fallback_narrative(comps: _Components, bucket: Bucket, matching_inventory: int) -> tuple[str, str]:
    """Template narrative used when the LLM layer is unavailable."""
    parts = []
    if comps.completeness >= 20:
        parts.append("Perfil completo")
    elif comps.completeness >= 10:
        parts.append("Perfil con datos parciales")
    else:
        parts.append("Perfil con datos insuficientes")

    if matching_inventory >= 16:
        parts.append(f"presupuesto realista ({matching_inventory} propiedades en rango)")
    elif matching_inventory >= 1:
        parts.append(f"presupuesto restrictivo ({matching_inventory} propiedades en rango)")
    else:
        parts.append("presupuesto sin oferta actual en el catalogo")

    if comps.engagement >= 16:
        parts.append("con actividad reciente alta")
    elif comps.engagement >= 8:
        parts.append("con actividad moderada")
    else:
        parts.append("sin actividad reciente")

    reasoning = ". ".join(parts) + "."

    if bucket == "hot":
        action = "Llamar hoy y proponer 2-3 visitas en las zonas declaradas."
    elif bucket == "warm":
        action = "Enviar opciones por WhatsApp y agendar una llamada esta semana."
    else:
        action = "Pedir mas detalles del presupuesto y zonas antes de invertir tiempo."

    return reasoning, action


def _bucket_neighbor(target: Bucket, base: Bucket) -> Bucket:
    """Clamp `target` so it differs from `base` by at most one level."""
    order = ["cold", "warm", "hot"]
    bi = order.index(base)
    ti = order.index(target)
    if abs(ti - bi) <= 1:
        return target
    return order[bi + (1 if ti > bi else -1)]  # type: ignore[return-value]


def _format_lead_block(lead: Lead) -> str:
    return json.dumps(
        {
            "full_name": lead.full_name,
            "intent": lead.intent,
            "status": lead.status,
            "source": lead.source,
            "budget_min_usd": float(lead.budget_min_usd) if lead.budget_min_usd else None,
            "budget_max_usd": float(lead.budget_max_usd) if lead.budget_max_usd else None,
            "zonas": list(lead.zonas or []),
            "bedrooms_min": lead.bedrooms_min,
            "area_min_m2": lead.area_min_m2,
            "must_haves": list(lead.must_haves or []),
            "notes": lead.notes or "",
            "has_phone": bool(lead.phone),
            "has_email": bool(lead.email),
        },
        ensure_ascii=False,
        indent=2,
    )


async def _matching_inventory_count(lead: Lead) -> int:
    if lead.budget_min_usd is None or lead.budget_max_usd is None:
        return 0
    q = Property.objects().where(
        (Property.listing_type == lead.intent)
        & (Property.price >= lead.budget_min_usd)
        & (Property.price <= lead.budget_max_usd)
    )
    rows = await q.run()
    return len(rows)


async def score_lead(lead_id: int) -> LeadScoreResponse | None:
    lead = await Lead.objects().where(Lead.id == lead_id).first().run()
    if lead is None:
        return None

    catalog_size = await Property.count().run()
    matching_inventory = await _matching_inventory_count(lead)
    showings_count = await Showing.count().where(Showing.lead == lead_id).run()

    comps = _deterministic_components(lead, matching_inventory, showings_count, catalog_size)
    total = comps.total
    base_bucket = _bucket(total)
    final_bucket = base_bucket
    reasoning, next_action = _fallback_narrative(comps, base_bucket, matching_inventory)
    llm_used = False

    llm = get_llm_client()
    if llm.available:
        user_prompt = LEAD_SCORING_USER_TEMPLATE.format(
            lead_block=_format_lead_block(lead),
            completeness=comps.completeness,
            budget_realism=comps.budget_realism,
            engagement=comps.engagement,
            intent_clarity=comps.intent_clarity,
            total=total,
            bucket=base_bucket,
            matching_inventory=matching_inventory,
            showings=showings_count,
        )
        payload = llm.ask_json(system=LEAD_SCORING_SYSTEM, user=user_prompt, max_tokens=400)
        if isinstance(payload, dict):
            try:
                bucket_raw = str(payload.get("bucket", base_bucket)).lower().strip()
                bucket_clean: Bucket = bucket_raw if bucket_raw in {"hot", "warm", "cold"} else base_bucket  # type: ignore[assignment]
                final_bucket = _bucket_neighbor(bucket_clean, base_bucket)
                reasoning = str(payload.get("reasoning_es", reasoning)).strip() or reasoning
                next_action = str(payload.get("next_action", next_action)).strip() or next_action
                llm_used = True
            except Exception:
                # Stay with the deterministic fallback rather than 500.
                llm_used = False

    return LeadScoreResponse(
        lead_id=lead.id,
        score=total,
        bucket=final_bucket,
        components=ScoreComponents(**asdict(comps)),
        reasoning_es=reasoning,
        next_action=next_action[:120],
        matching_inventory=matching_inventory,
        showings=showings_count,
        llm_used=llm_used,
    )
