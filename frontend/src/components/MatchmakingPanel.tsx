import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "../api/client";
import { matchLead, type Match, type Matchmaking } from "../api/ai";
import { AiSkeleton } from "./AiSkeleton";

function fitBadge(score: number): string {
  if (score >= 80) return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (score >= 60) return "bg-blue-50 text-blue-700 border-blue-200";
  if (score >= 40) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

type Props = {
  leadId: number;
  onStartShowing?: (propertyId: number) => void;
};

export function MatchmakingPanel({ leadId, onStartShowing }: Props) {
  const [result, setResult] = useState<Matchmaking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runMatch() {
    setLoading(true);
    setError(null);
    try {
      const data = await matchLead(leadId, 5);
      setResult(data);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.status}: ${err.message}`);
      else if (err instanceof Error) setError(err.message);
      else setError("No se pudieron buscar coincidencias.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <span aria-hidden>🤖</span>
          Matchmaking (IA)
        </h2>
        {result && (
          <button
            type="button"
            onClick={runMatch}
            disabled={loading}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 disabled:opacity-50"
          >
            {loading ? "Buscando…" : "Recalcular"}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-600">
          {error}
        </div>
      )}

      {!result && !loading && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Cruza las preferencias declaradas del lead contra el catálogo actual y rankea las
            mejores opciones con explicaciones generadas por IA.
          </p>
          <button
            type="button"
            onClick={runMatch}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-purple-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <span aria-hidden>✨</span>
            Sugerir propiedades
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <AiSkeleton lines={3} />
          <AiSkeleton lines={3} />
        </div>
      )}

      {result && !loading && (
        <div className="space-y-3">
          {result.matches.length === 0 ? (
            <p className="text-sm text-slate-500">
              No se encontraron propiedades que encajen con las preferencias del lead. Probá
              ampliar el rango de presupuesto o quitar restricciones de zonas.
            </p>
          ) : (
            <>
              <p className="text-xs text-slate-500">
                {result.matches.length} sugerencia{result.matches.length === 1 ? "" : "s"} sobre{" "}
                {result.candidates_considered} candidato
                {result.candidates_considered === 1 ? "" : "s"} prefiltrado
                {result.candidates_considered === 1 ? "" : "s"}
              </p>
              <ul className="space-y-3">
                {result.matches.map((m) => (
                  <MatchRow key={m.property.id} match={m} onStartShowing={onStartShowing} />
                ))}
              </ul>
            </>
          )}
          <p className="text-[10px] uppercase tracking-wider text-slate-400">
            {result.llm_used ? "OpenAI + heurísticas" : "Heurísticas (modo offline)"}
          </p>
        </div>
      )}
    </div>
  );
}

function MatchRow({
  match,
  onStartShowing,
}: {
  match: Match;
  onStartShowing?: (propertyId: number) => void;
}) {
  const p = match.property;
  return (
    <li className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 transition-colors hover:border-slate-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Link
            to={`/properties/${p.id}`}
            className="font-medium text-slate-900 hover:text-blue-600"
          >
            {p.title}
          </Link>
          <p className="text-xs text-slate-500 mt-0.5">
            {p.location} · ${Number(p.price).toLocaleString()}{" "}
            {p.bedrooms != null && <>· {p.bedrooms} dorm.</>}
          </p>
        </div>
        <span
          className={`shrink-0 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${fitBadge(match.fit_score)}`}
        >
          {match.fit_score}% fit
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-700">{match.why_es}</p>
      {match.concerns_es && (
        <p className="mt-1 text-xs text-amber-700 bg-amber-50/70 border border-amber-100 rounded px-2 py-1">
          ⚠ {match.concerns_es}
        </p>
      )}
      {onStartShowing && (
        <button
          type="button"
          onClick={() => onStartShowing(p.id)}
          className="mt-3 inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 border border-blue-100"
        >
          Agendar visita →
        </button>
      )}
    </li>
  );
}
