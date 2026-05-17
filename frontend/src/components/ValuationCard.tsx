import { useState } from "react";
import { ApiError } from "../api/client";
import { valueProperty, type Valuation } from "../api/ai";
import { AiSkeleton } from "./AiSkeleton";

const CONFIDENCE_STYLE: Record<Valuation["confidence"], { label: string; cls: string }> = {
  high: { label: "Alta", cls: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  medium: { label: "Media", cls: "border-amber-200 bg-amber-50 text-amber-700" },
  low: { label: "Baja", cls: "border-slate-200 bg-slate-50 text-slate-600" },
};

type Props = {
  propertyId: number;
  currentPriceHint?: number;
};

export function ValuationCard({ propertyId, currentPriceHint }: Props) {
  const [val, setVal] = useState<Valuation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const data = await valueProperty(propertyId);
      setVal(data);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.status}: ${err.message}`);
      else if (err instanceof Error) setError(err.message);
      else setError("No se pudo calcular la valuación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border-2 border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-emerald-900 flex items-center gap-2">
          <span aria-hidden>📊</span>
          Valuación dinámica (IA)
        </h2>
        {val && (
          <button
            type="button"
            onClick={run}
            disabled={loading}
            className="text-xs font-medium text-emerald-700 hover:text-emerald-900 disabled:opacity-50"
          >
            {loading ? "Calculando…" : "Recalcular"}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {!val && !loading && (
        <div className="space-y-3">
          <p className="text-sm text-emerald-800">
            Estimación basada en comparables reales del mercado y características de la propiedad
            (estado legal, antigüedad, amenidades).
          </p>
          <button
            type="button"
            onClick={run}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <span aria-hidden>✨</span>
            Calcular valuación
          </button>
        </div>
      )}

      {loading && <AiSkeleton lines={5} />}

      {val && !loading && (
        <ValuationBody val={val} currentPriceHint={currentPriceHint} />
      )}
    </div>
  );
}

function ValuationBody({
  val,
  currentPriceHint,
}: {
  val: Valuation;
  currentPriceHint?: number;
}) {
  const suggested = Number(val.suggested_price_usd);
  const low = Number(val.range_low);
  const high = Number(val.range_high);
  const current = Number(val.current_price_usd) || currentPriceHint || 0;
  const inside = current >= low && current <= high;
  const diff = current > 0 ? ((current - suggested) / suggested) * 100 : 0;

  const diffStyle =
    Math.abs(diff) <= 5
      ? "text-emerald-700"
      : Math.abs(diff) <= 12
        ? "text-amber-700"
        : "text-rose-700";

  const conf = CONFIDENCE_STYLE[val.confidence];

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-emerald-700 mb-1">
          Sugerido
        </p>
        <p className="text-4xl font-bold text-emerald-700 tabular-nums">
          ${suggested.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
        <p className="text-sm text-emerald-800 mt-1 tabular-nums">
          Banda: ${low.toLocaleString(undefined, { maximumFractionDigits: 0 })} –{" "}
          ${high.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg border border-emerald-100 bg-white/70 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700">
            Precio actual
          </p>
          <p className="font-semibold tabular-nums text-slate-900">
            ${current.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          {current > 0 && (
            <p className={`text-xs font-medium ${diffStyle}`}>
              {diff > 0 ? "+" : ""}
              {diff.toFixed(1)}% vs sugerido
            </p>
          )}
        </div>
        <div className="rounded-lg border border-emerald-100 bg-white/70 px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-emerald-700">
            Confianza
          </p>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${conf.cls}`}
          >
            {conf.label}
          </span>
          <p className="text-[10px] text-emerald-800 mt-1">
            {val.comps_count} comparable{val.comps_count === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {current > 0 && (
        <div
          className={`rounded-lg border px-3 py-2 text-sm ${
            inside
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {inside
            ? "El precio actual está dentro de la banda sugerida — alineado con mercado."
            : current > high
              ? `Por encima de la banda en $${(current - high).toLocaleString(undefined, { maximumFractionDigits: 0 })}.`
              : `Por debajo de la banda en $${(low - current).toLocaleString(undefined, { maximumFractionDigits: 0 })}.`}
        </div>
      )}

      <p className="text-sm text-slate-700 leading-relaxed">{val.narrative_es}</p>

      {val.drivers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {val.drivers.map((d) => (
            <span
              key={d}
              className="inline-flex items-center rounded-md border border-emerald-200 bg-white px-2 py-0.5 text-xs font-medium text-emerald-700"
            >
              {d}
            </span>
          ))}
        </div>
      )}

      <p className="text-[10px] uppercase tracking-wider text-emerald-700/70">
        {val.llm_used ? "OpenAI + comparables" : "Comparables (modo offline)"}
      </p>
    </div>
  );
}
