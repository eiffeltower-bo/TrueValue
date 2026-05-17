"""Dynamic property valuation from comparables.

Pipeline:
1. Pull comparable listings (same type, same city, similar area & bedrooms,
   within ~12 months) from the catalog.
2. Compute median, p25, p75 on both raw price and price/m² where area
   data exists.
3. Apply deterministic adjustments for legal_status, amenities count, and
   building age to obtain a base suggested price.
4. Ask the LLM for a narrative + drivers + a clamped suggested price
   (±10% of the deterministic base). Fall back to template narrative
   when the LLM is unavailable.
"""

from __future__ import annotations

import json
import statistics
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from app.ai.client import get_llm_client
from app.ai.prompts import VALUATION_SYSTEM, VALUATION_USER_TEMPLATE
from app.schemas.ai import Confidence, ValuationResponse
from app.tables.properties import Property

COMP_AREA_TOLERANCE = 0.25  # ±25% on area
COMP_BEDROOM_TOLERANCE = 1  # ±1 bedrooms
COMP_LOOKBACK_DAYS = 365
COMP_MIN = 3
COMP_MAX = 20
LLM_CLAMP_PCT = Decimal("0.10")  # ±10% around deterministic base
RANGE_PCT = Decimal("0.12")  # default ±12% band when LLM doesn't widen


def _city_from_location(location: str) -> str:
    if "," in location:
        return location.split(",", 1)[1].strip()
    return location.strip()


def _zona_from_location(location: str) -> str:
    return location.split(",", 1)[0].strip() if "," in location else location


async def _fetch_comps(target: Property) -> list[Property]:
    city = _city_from_location(target.location or "")
    earliest = datetime.now(UTC) - timedelta(days=COMP_LOOKBACK_DAYS)

    q = Property.objects().where(
        (Property.property_type == target.property_type)
        & (Property.listing_type == target.listing_type)
        & (Property.id != target.id)
        & (Property.created_at >= earliest)
        & (Property.location.ilike(f"%{city}%"))
    )
    rows = await q.run()

    def _ok(p: Property) -> bool:
        if (
            target.bedrooms is not None
            and p.bedrooms is not None
            and abs(p.bedrooms - target.bedrooms) > COMP_BEDROOM_TOLERANCE
        ):
            return False
        if target.area_total_m2 and p.area_total_m2:
            lo = target.area_total_m2 * (1 - COMP_AREA_TOLERANCE)
            hi = target.area_total_m2 * (1 + COMP_AREA_TOLERANCE)
            if not (lo <= p.area_total_m2 <= hi):
                return False
        return True

    filtered = [p for p in rows if _ok(p)]
    # If we got fewer than the minimum, relax the bedroom/area filters.
    if len(filtered) < COMP_MIN:
        filtered = rows[:]

    return filtered[:COMP_MAX]


def _legal_adj_pct(prop: Property) -> Decimal:
    return {
        "saneado": Decimal("0.05"),
        "en_tramite": Decimal("0"),
        "pendiente": Decimal("-0.03"),
        "con_observaciones": Decimal("-0.10"),
    }.get(prop.legal_status or "", Decimal("0"))


def _amenities_adj_pct(prop: Property) -> Decimal:
    n = len(prop.amenities or [])
    # +1% per amenity, capped at +8%
    return min(Decimal("0.08"), Decimal("0.01") * n)


def _age_adj_pct(prop: Property) -> Decimal:
    if not prop.year_built:
        return Decimal("0")
    age = max(0, datetime.now(UTC).year - prop.year_built)
    if age <= 5:
        return Decimal("0.05")
    if age <= 15:
        return Decimal("0.02")
    if age <= 30:
        return Decimal("-0.02")
    return Decimal("-0.06")


def _confidence(comps_count: int, p25: float, p75: float) -> Confidence:
    if comps_count < COMP_MIN:
        return "low"
    spread = (p75 - p25) / max(1.0, (p25 + p75) / 2)
    if comps_count >= 8 and spread <= 0.20:
        return "high"
    if comps_count >= 4 and spread <= 0.35:
        return "medium"
    return "low" if comps_count < 4 else "medium"


def _clamp_to_base(suggested: Decimal, base: Decimal) -> Decimal:
    lo = base * (1 - LLM_CLAMP_PCT)
    hi = base * (1 + LLM_CLAMP_PCT)
    return max(lo, min(hi, suggested))


def _format_property_block(prop: Property) -> str:
    return json.dumps(
        {
            "title": prop.title,
            "type": prop.property_type,
            "listing_type": prop.listing_type,
            "location": prop.location,
            "current_price_usd": float(prop.price),
            "area_total_m2": prop.area_total_m2,
            "area_construida_m2": prop.area_construida_m2,
            "bedrooms": prop.bedrooms,
            "bathrooms": prop.bathrooms,
            "year_built": prop.year_built,
            "legal_status": prop.legal_status,
            "amenities": list(prop.amenities or []),
        },
        ensure_ascii=False,
        indent=2,
    )


def _fallback_narrative(
    prop: Property,
    comps_count: int,
    median_price: Decimal,
    legal_adj: Decimal,
    amen_adj: Decimal,
    age_adj: Decimal,
    base: Decimal,
) -> tuple[str, list[str]]:
    drivers: list[str] = []
    if legal_adj > 0:
        drivers.append("Estado saneado")
    elif legal_adj < 0:
        drivers.append(f"Estado legal: {prop.legal_status}")
    if amen_adj > 0:
        drivers.append(f"{len(prop.amenities or [])} amenidades")
    if age_adj > 0:
        drivers.append("Construccion reciente")
    elif age_adj < 0:
        drivers.append("Construccion con anos")
    zona = _zona_from_location(prop.location or "")
    if zona:
        drivers.append(f"Zona: {zona}")

    if comps_count < COMP_MIN:
        narrative = (
            f"Tasacion preliminar con solo {comps_count} comparables; el rango es amplio "
            "y conviene recolectar mas datos del mercado en la zona antes de cerrar precio."
        )
    else:
        diff_pct = (base - prop.price) / max(prop.price, Decimal("1"))
        if diff_pct > Decimal("0.05"):
            narrative = (
                f"El precio actual luce conservador frente al sugerido (USD {int(base):,}, "
                f"derivado de {comps_count} comparables); conviene revisar al alza."
            )
        elif diff_pct < Decimal("-0.05"):
            narrative = (
                f"El precio actual luce alto frente al sugerido (USD {int(base):,}, "
                f"derivado de {comps_count} comparables); el mercado podria ajustar."
            )
        else:
            narrative = (
                f"El precio actual esta alineado con el sugerido (USD {int(base):,}) "
                f"segun {comps_count} comparables. La banda sugerida tolera negociacion modesta."
            )
    return narrative, drivers[:4]


async def value_property(property_id: int) -> ValuationResponse | None:
    target = await Property.objects().where(Property.id == property_id).first().run()
    if target is None:
        return None

    comps = await _fetch_comps(target)
    comps_count = len(comps)

    prices = [float(p.price) for p in comps]
    median_price = Decimal(str(round(statistics.median(prices), 2))) if prices else target.price
    p25 = statistics.quantiles(prices, n=4)[0] if len(prices) >= 4 else (prices[0] if prices else float(target.price))
    p75 = statistics.quantiles(prices, n=4)[2] if len(prices) >= 4 else (prices[-1] if prices else float(target.price))

    price_per_m2_samples: list[float] = []
    for p in comps:
        area = p.area_construida_m2 or p.area_total_m2
        if area and area > 0:
            price_per_m2_samples.append(float(p.price) / area)
    median_ppm2: Decimal | None = (
        Decimal(str(round(statistics.median(price_per_m2_samples), 2)))
        if price_per_m2_samples
        else None
    )

    # Base suggested: median price OR (if we have m² and a ppm2 median) ppm2 × target area.
    base = median_price
    target_area = target.area_construida_m2 or target.area_total_m2
    if median_ppm2 is not None and target_area:
        base = Decimal(str(round(float(median_ppm2) * target_area, 2)))

    legal_adj = _legal_adj_pct(target)
    amen_adj = _amenities_adj_pct(target)
    age_adj = _age_adj_pct(target)
    adjusted_base = (base * (Decimal("1") + legal_adj + amen_adj + age_adj)).quantize(Decimal("1"))

    confidence: Confidence = _confidence(comps_count, p25, p75)
    suggested = adjusted_base
    range_low = (adjusted_base * (Decimal("1") - RANGE_PCT)).quantize(Decimal("1"))
    range_high = (adjusted_base * (Decimal("1") + RANGE_PCT)).quantize(Decimal("1"))
    narrative, drivers = _fallback_narrative(
        target, comps_count, median_price, legal_adj, amen_adj, age_adj, adjusted_base
    )
    llm_used = False

    llm = get_llm_client()
    if llm.available and comps_count >= 1:
        user_prompt = VALUATION_USER_TEMPLATE.format(
            property_block=_format_property_block(target),
            comps_count=comps_count,
            median_price=f"{float(median_price):,.0f}",
            median_price_per_m2=f"{float(median_ppm2):,.2f}" if median_ppm2 else "n/a",
            p25_price=f"{p25:,.0f}",
            p75_price=f"{p75:,.0f}",
            legal_adj=f"{float(legal_adj) * 100:+.1f}%",
            amenities_adj=f"{float(amen_adj) * 100:+.1f}%",
            age_adj=f"{float(age_adj) * 100:+.1f}%",
            base_suggested=f"{float(adjusted_base):,.0f}",
            current_price=f"{float(target.price):,.0f}",
        )
        payload = llm.ask_json(system=VALUATION_SYSTEM, user=user_prompt, max_tokens=600)
        if isinstance(payload, dict):
            try:
                llm_suggested = Decimal(str(payload.get("suggested_price_usd", adjusted_base)))
                suggested = _clamp_to_base(llm_suggested, adjusted_base).quantize(Decimal("1"))
                llm_low = Decimal(str(payload.get("range_low", range_low)))
                llm_high = Decimal(str(payload.get("range_high", range_high)))
                # Clamp the range to ±15% of suggested.
                hard_low = suggested * Decimal("0.85")
                hard_high = suggested * Decimal("1.15")
                range_low = max(hard_low, min(suggested, llm_low)).quantize(Decimal("1"))
                range_high = min(hard_high, max(suggested, llm_high)).quantize(Decimal("1"))

                conf_raw = str(payload.get("confidence", confidence)).lower().strip()
                if conf_raw in {"high", "medium", "low"}:
                    confidence = conf_raw  # type: ignore[assignment]
                narrative = str(payload.get("narrative_es", narrative)).strip() or narrative
                drivers_raw = payload.get("drivers", drivers)
                if isinstance(drivers_raw, list):
                    drivers = [str(d).strip() for d in drivers_raw if str(d).strip()][:4]
                llm_used = True
            except Exception:
                llm_used = False

    return ValuationResponse(
        property_id=target.id,
        suggested_price_usd=suggested,
        range_low=range_low,
        range_high=range_high,
        current_price_usd=target.price,
        confidence=confidence,
        comps_count=comps_count,
        median_price_per_m2=median_ppm2,
        narrative_es=narrative,
        drivers=drivers,
        llm_used=llm_used,
    )
