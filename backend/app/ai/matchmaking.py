"""Lead -> property matchmaking.

Pipeline:
1. SQL prefilter against the catalog using the lead's stated preferences,
   with a tolerance band so we are not too strict.
2. Deterministic per-candidate fit score (0-100) over price, location,
   bedrooms, area, legal_status, must_haves overlap.
3. Take the top 10 deterministic candidates and ask the LLM to rerank with
   a why/concerns narrative. Fall back to template strings if the LLM is
   offline.
"""

from __future__ import annotations

import json
from decimal import Decimal

from app.ai.client import get_llm_client
from app.ai.prompts import MATCHMAKING_SYSTEM, MATCHMAKING_USER_TEMPLATE
from app.schemas.ai import MatchItem, MatchmakingResponse
from app.schemas.properties import PropertyRead
from app.tables.leads import Lead
from app.tables.properties import Property

PRICE_TOLERANCE = Decimal("0.15")  # ±15% on price band when prefiltering
PREFILTER_LIMIT = 30  # SQL prefilter result cap
RERANK_LIMIT = 10  # how many candidates we send to the LLM


def _property_to_read(prop: Property) -> PropertyRead:
    return PropertyRead(
        id=prop.id,
        title=prop.title,
        price=prop.price,
        property_type=prop.property_type,
        location=prop.location,
        agent_id=prop.agent,
        created_at=prop.created_at,
        area_total_m2=prop.area_total_m2,
        area_construida_m2=prop.area_construida_m2,
        bedrooms=prop.bedrooms,
        bathrooms=prop.bathrooms,
        garages=prop.garages,
        floors=prop.floors,
        year_built=prop.year_built,
        listing_type=prop.listing_type,
        legal_status=prop.legal_status,
        utilities=list(prop.utilities or []),
        amenities=list(prop.amenities or []),
    )


async def _prefilter(lead: Lead) -> list[Property]:
    conds = [Property.listing_type == lead.intent]
    if lead.budget_min_usd is not None:
        conds.append(Property.price >= lead.budget_min_usd * (1 - PRICE_TOLERANCE))
    if lead.budget_max_usd is not None:
        conds.append(Property.price <= lead.budget_max_usd * (1 + PRICE_TOLERANCE))
    if lead.bedrooms_min is not None:
        # bedrooms nullable in DB → only filter rows where the field is set
        # AND meets the threshold; rows with NULL bedrooms get scored later.
        conds.append((Property.bedrooms.is_null()) | (Property.bedrooms >= lead.bedrooms_min - 1))

    q = Property.objects()
    for c in conds:
        q = q.where(c)

    rows = await q.limit(PREFILTER_LIMIT * 2).run()

    # Zone filter: substring match against any of the lead's zonas
    if lead.zonas:
        wanted = [z.lower() for z in lead.zonas]
        rows = [p for p in rows if any(z in (p.location or "").lower() for z in wanted)]

    return rows[:PREFILTER_LIMIT]


def _fit_score(lead: Lead, prop: Property) -> int:
    score = 0

    # Price proximity (40 pts): center of the band → 40, edges → 20, outside → 0.
    if lead.budget_min_usd is not None and lead.budget_max_usd is not None:
        lo = float(lead.budget_min_usd)
        hi = float(lead.budget_max_usd)
        price = float(prop.price)
        center = (lo + hi) / 2
        if lo <= price <= hi:
            half_span = max(1.0, (hi - lo) / 2)
            offset = abs(price - center) / half_span
            score += int(40 - offset * 20)  # 40 at center, 20 at edges
        else:
            band = hi - lo if hi > lo else lo * 0.2
            outside = min(abs(price - hi), abs(price - lo))
            ratio = outside / max(1.0, band)
            score += max(0, int(15 - ratio * 30))
    else:
        score += 15  # no band given → neutral

    # Zona match (25 pts): exact substring (case-insensitive) of any zona.
    loc = (prop.location or "").lower()
    if lead.zonas and any(z.lower() in loc for z in lead.zonas):
        score += 25

    # Bedrooms (15 pts)
    if lead.bedrooms_min is not None and prop.bedrooms is not None:
        delta = prop.bedrooms - lead.bedrooms_min
        if delta >= 0:
            score += 15
        elif delta == -1:
            score += 7

    # Min area (10 pts)
    if lead.area_min_m2 is not None and prop.area_total_m2 is not None:
        if prop.area_total_m2 >= lead.area_min_m2:
            score += 10
        elif prop.area_total_m2 >= lead.area_min_m2 * 0.85:
            score += 5

    # Legal status (10 pts): saneado is the obvious win.
    if prop.legal_status == "saneado":
        score += 10
    elif prop.legal_status in {"en_tramite", "pendiente"}:
        score += 4

    # Must-haves ∩ amenities (up to 10 pts, 2.5 per overlap)
    if lead.must_haves and prop.amenities:
        wanted = {m.lower() for m in lead.must_haves}
        have = {a.lower() for a in prop.amenities}
        overlap = len(wanted & have)
        score += min(10, int(overlap * 2.5))

    return max(0, min(100, score))


def _fallback_match_narrative(lead: Lead, prop: Property, score: int) -> tuple[str, str | None]:
    reasons: list[str] = []
    if lead.zonas and any(z.lower() in (prop.location or "").lower() for z in lead.zonas):
        reasons.append(f"ubicada en {prop.location.split(',')[0]}, una de las zonas del lead")
    if (
        lead.budget_min_usd is not None
        and lead.budget_max_usd is not None
        and lead.budget_min_usd <= prop.price <= lead.budget_max_usd
    ):
        reasons.append(f"precio USD {int(prop.price):,} dentro del presupuesto")
    if lead.bedrooms_min is not None and prop.bedrooms is not None and prop.bedrooms >= lead.bedrooms_min:
        reasons.append(f"{prop.bedrooms} dormitorios cumple el minimo")
    if prop.legal_status == "saneado":
        reasons.append("estado saneado")
    why = "Encaja porque " + ", ".join(reasons) + "." if reasons else "Coincide con el perfil del lead."

    concerns: str | None = None
    if prop.legal_status in {"con_observaciones", "en_tramite"}:
        concerns = f"Atencion: legal_status = {prop.legal_status}, requiere due diligence."
    elif (
        lead.budget_max_usd is not None
        and prop.price > lead.budget_max_usd
    ):
        excess = float(prop.price) - float(lead.budget_max_usd)
        concerns = f"Excede el presupuesto en USD {int(excess):,}."
    elif (
        lead.bedrooms_min is not None
        and prop.bedrooms is not None
        and prop.bedrooms < lead.bedrooms_min
    ):
        concerns = f"Tiene {prop.bedrooms} dormitorios, el lead pidio {lead.bedrooms_min}+."

    return why, concerns


def _format_lead_block(lead: Lead) -> str:
    return json.dumps(
        {
            "intent": lead.intent,
            "budget_min_usd": float(lead.budget_min_usd) if lead.budget_min_usd else None,
            "budget_max_usd": float(lead.budget_max_usd) if lead.budget_max_usd else None,
            "zonas": list(lead.zonas or []),
            "bedrooms_min": lead.bedrooms_min,
            "area_min_m2": lead.area_min_m2,
            "must_haves": list(lead.must_haves or []),
            "notes": lead.notes or "",
        },
        ensure_ascii=False,
        indent=2,
    )


def _format_candidate(prop: Property, det_score: int) -> dict:
    return {
        "property_id": prop.id,
        "title": prop.title,
        "price_usd": float(prop.price),
        "location": prop.location,
        "type": prop.property_type,
        "listing_type": prop.listing_type,
        "bedrooms": prop.bedrooms,
        "bathrooms": prop.bathrooms,
        "area_total_m2": prop.area_total_m2,
        "area_construida_m2": prop.area_construida_m2,
        "year_built": prop.year_built,
        "legal_status": prop.legal_status,
        "amenities": list(prop.amenities or []),
        "deterministic_fit": det_score,
    }


async def match_lead(lead_id: int, limit: int = 5) -> MatchmakingResponse | None:
    lead = await Lead.objects().where(Lead.id == lead_id).first().run()
    if lead is None:
        return None

    candidates = await _prefilter(lead)
    scored = [(p, _fit_score(lead, p)) for p in candidates]
    scored.sort(key=lambda x: x[1], reverse=True)
    top = scored[:RERANK_LIMIT]
    candidates_considered = len(candidates)

    if not top:
        return MatchmakingResponse(
            lead_id=lead.id,
            matches=[],
            candidates_considered=0,
            llm_used=False,
        )

    llm = get_llm_client()
    llm_payload: dict | None = None
    if llm.available:
        candidates_block = json.dumps(
            [_format_candidate(p, s) for p, s in top], ensure_ascii=False, indent=2
        )
        user_prompt = MATCHMAKING_USER_TEMPLATE.format(
            lead_block=_format_lead_block(lead),
            candidates_block=candidates_block,
        )
        llm_payload = llm.ask_json(system=MATCHMAKING_SYSTEM, user=user_prompt, max_tokens=1200)

    by_id = {p.id: (p, s) for p, s in top}
    matches: list[MatchItem] = []
    llm_used = False

    if isinstance(llm_payload, dict) and isinstance(llm_payload.get("ranking"), list):
        for item in llm_payload["ranking"]:
            try:
                pid = int(item["property_id"])
            except (KeyError, TypeError, ValueError):
                continue
            entry = by_id.get(pid)
            if entry is None:
                continue
            prop, det = entry
            try:
                fit = int(item.get("fit_score", det))
                fit = max(0, min(100, fit))
            except (TypeError, ValueError):
                fit = det
            why = str(item.get("why_es", "")).strip()
            concerns_raw = item.get("concerns_es")
            concerns = (
                str(concerns_raw).strip()
                if concerns_raw not in (None, "", "null")
                else None
            )
            if not why:
                why, concerns_fb = _fallback_match_narrative(lead, prop, det)
                concerns = concerns or concerns_fb
            matches.append(
                MatchItem(
                    property=_property_to_read(prop),
                    fit_score=fit,
                    why_es=why,
                    concerns_es=concerns,
                )
            )
        if matches:
            llm_used = True

    if not matches:
        # LLM unavailable or returned nothing usable. Build deterministic narratives.
        for prop, det in top:
            why, concerns = _fallback_match_narrative(lead, prop, det)
            matches.append(
                MatchItem(
                    property=_property_to_read(prop),
                    fit_score=det,
                    why_es=why,
                    concerns_es=concerns,
                )
            )

    matches.sort(key=lambda m: m.fit_score, reverse=True)
    matches = matches[:limit]

    return MatchmakingResponse(
        lead_id=lead.id,
        matches=matches,
        candidates_considered=candidates_considered,
        llm_used=llm_used,
    )
