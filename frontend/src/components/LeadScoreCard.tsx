import { useState } from "react";
import { ApiError } from "../api/client";
import { scoreLead, type LeadScore } from "../api/ai";
import { AiSkeleton } from "./AiSkeleton";

const BUCKET_STYLE: Record<LeadScore["bucket"], { label: string; cls: string; dot: string }> = {
  hot: {
    label: "Hot",
    cls: "border-rose-200 bg-rose-50 text-rose-700",
    dot: "bg-rose-500",
  },
  warm: {
    label: "Warm",
    cls: "border-amber-200 bg-amber-50 text-amber-700",
    dot: "bg-amber-500",
  },
  cold: {
    label: "Cold",
    cls: "border-slate-200 bg-slate-50 text-slate-600",
    dot: "bg-slate-400",
  },
};

type Props = {
  leadId: number;
};

export function LeadScoreCard({ leadId }: Props) {
  const [score, setScore] = useState<LeadScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runScoring() {
    setLoading(true);
    setError(null);
    try {
      const result = await scoreLead(leadId);
      setScore(result);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.status}: ${err.message}`);
      else if (err instanceof Error) setError(err.message);
      else setError("No se pudo calcular el score.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <span aria-hidden>✨</span>
          Lead scoring (IA)
        </h2>
        {score && (
          <button
            type="button"
            onClick={runScoring}
            disabled={loading}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
          >
            {loading ? "Recalculando…" : "Recalcular"}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {!score && !loading && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Calificá automáticamente este lead combinando completeness, realismo del presupuesto,
            engagement reciente y claridad de intención.
          </p>
          <button
            type="button"
            onClick={runScoring}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <span aria-hidden>✨</span>
            Calcular score
          </button>
        </div>
      )}

      {loading && <AiSkeleton lines={4} />}

      {score && !loading && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-slate-100">
              <span className="text-2xl font-bold tabular-nums text-slate-900">{score.score}</span>
              <span className="absolute -bottom-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                /100
              </span>
            </div>
            <div className="space-y-1">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold uppercase tracking-wider ${BUCKET_STYLE[score.bucket].cls}`}
              >
                <span className={`h-2 w-2 rounded-full ${BUCKET_STYLE[score.bucket].dot}`} />
                {BUCKET_STYLE[score.bucket].label}
              </span>
              <p className="text-xs text-slate-500">
                {score.matching_inventory} propiedad{score.matching_inventory === 1 ? "" : "es"} en
                rango · {score.showings} visita{score.showings === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <ScorePill label="Completitud" value={score.components.completeness} />
            <ScorePill label="Presupuesto" value={score.components.budget_realism} />
            <ScorePill label="Engagement" value={score.components.engagement} />
            <ScorePill label="Intención" value={score.components.intent_clarity} />
          </div>

          <div className="space-y-2">
            <p className="text-sm text-slate-700 leading-relaxed">{score.reasoning_es}</p>
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700 mb-0.5">
                Próxima acción
              </p>
              <p className="text-sm text-indigo-900">{score.next_action}</p>
            </div>
          </div>

          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            {score.llm_used ? "OpenAI + heurísticas" : "Heurísticas (modo offline)"}
          </p>
        </div>
      )}
    </div>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-slate-900">{value}/25</p>
    </div>
  );
}
