import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { getProperty, type Property } from "../api/properties";
import { getUser, displayName, type User } from "../api/users";
import { listLeads, type Lead } from "../api/leads";
import { endShowing, listShowings, startShowing, type Showing } from "../api/showings";
import { useAuth } from "../auth/AuthContext";
import {
  listLatestMeasurements,
  listVisitorEvents,
  type Measurement,
  type Presence,
  type VisitorEvent,
} from "../api/edge";
import { ValuationCard } from "../components/ValuationCard";

// Visual styles for the Bolivia-specific status fields. Anything outside the
// known set falls back to neutral slate.
const LISTING_TYPE_STYLES: Record<string, { label: string; cls: string }> = {
  venta:       { label: "Venta",       cls: "bg-blue-50 text-blue-700 border-blue-100" },
  alquiler:    { label: "Alquiler",    cls: "bg-amber-50 text-amber-700 border-amber-100" },
  anticretico: { label: "Anticrético", cls: "bg-violet-50 text-violet-700 border-violet-100" },
};

const LEGAL_STATUS_STYLES: Record<string, { label: string; cls: string }> = {
  saneado:           { label: "Saneado",           cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  en_tramite:        { label: "En trámite",        cls: "bg-amber-50 text-amber-700 border-amber-100" },
  con_observaciones: { label: "Con observaciones", cls: "bg-orange-50 text-orange-700 border-orange-100" },
  pendiente:         { label: "Pendiente",         cls: "bg-slate-100 text-slate-700 border-slate-200" },
};

const FALLBACK_BADGE_CLS = "bg-slate-50 text-slate-700 border-slate-200";

const SPEC_EMOJI: Record<string, string> = {
  area_total_m2: "📐",
  area_construida_m2: "🏗️",
  bedrooms: "🛏️",
  bathrooms: "🚿",
  garages: "🚗",
  floors: "🏢",
  year_built: "📅",
};

const UTILITY_EMOJI: Record<string, string> = {
  agua: "💧",
  luz: "💡",
  alcantarillado: "🚰",
  "gas natural": "🔥",
  internet: "🌐",
  "calle pavimentada": "🛣️",
  "tv cable": "📺",
};

const AMENITY_EMOJI: Record<string, string> = {
  piscina: "🏊",
  parrillero: "🍖",
  "jardín": "🌳",
  jardin: "🌳",
  "seguridad 24h": "🛡️",
  ascensor: "🛗",
  quincho: "🍻",
  gimnasio: "🏋️",
  sauna: "🧖",
  "sala de eventos": "🎉",
  "cancha de tenis": "🎾",
  "área de niños": "🧒",
  "area de ninos": "🧒",
};

function emojiFor(map: Record<string, string>, key: string): string {
  return map[key.toLowerCase()] ?? "•";
}

const PRESENCE_STYLES: Record<Presence, { label: string; cls: string }> = {
  "no target":    { label: "Sin presencia", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  "still":        { label: "Quieto",        cls: "bg-blue-50 text-blue-700 border-blue-100" },
  "moving":       { label: "En movimiento", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  "moving+still": { label: "Mixto",         cls: "bg-amber-50 text-amber-700 border-amber-100" },
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "hace segundos";
  if (min < 60) return `hace ${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `hace ${hr} h`;
  const d = Math.floor(hr / 24);
  return `hace ${d} d`;
}

function computeAvgDwellMinutes(ins: VisitorEvent[], outs: VisitorEvent[]): number {
  const n = Math.min(ins.length, outs.length);
  if (n === 0) return 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += new Date(outs[i].timestamp).getTime() - new Date(ins[i].timestamp).getTime();
  }
  return total / n / 60000;
}

export function PropertyDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sensors, setSensors] = useState<Measurement[] | null>(null);
  const [events, setEvents] = useState<VisitorEvent[] | null>(null);
  const [agent, setAgent] = useState<User | null>(null);

  // Showings state
  const [showings, setShowings] = useState<Showing[]>([]);
  const [leadsById, setLeadsById] = useState<Map<number, Lead>>(new Map());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [showingError, setShowingError] = useState<string | null>(null);

  // The agent who initiated the showing — `user.user_id` exists for logged-in agents.
  const currentAgentId = (user as { user_id?: number } | null)?.user_id ?? null;
  const activeShowing = showings.find((s) => s.ended_at == null) ?? null;

  async function refreshShowings(propertyId: string | number) {
    const list = await listShowings({ property_id: Number(propertyId) }).catch(() => [] as Showing[]);
    setShowings(list);
    // Fill the lead lookup map for any unknown ids (cheap: we only fetch once on mount).
    if (list.length > 0 && leadsById.size === 0) {
      const leads = await listLeads().catch(() => [] as Lead[]);
      setLeadsById(new Map(leads.map((l) => [l.id, l])));
    }
  }

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setAgent(null);
    Promise.all([
      getProperty(id),
      listLatestMeasurements(id).catch(() => [] as Measurement[]),
      listVisitorEvents(id).catch(() => [] as VisitorEvent[]),
      listShowings({ property_id: Number(id) }).catch(() => [] as Showing[]),
    ])
      .then(([prop, sensorsData, eventsData, showingsData]) => {
        setProperty(prop);
        setSensors(sensorsData);
        setEvents(eventsData);
        setShowings(showingsData);
        getUser(prop.agent_id)
          .then(setAgent)
          .catch(() => setAgent(null));
        if (showingsData.length > 0) {
          listLeads()
            .then((leads) => setLeadsById(new Map(leads.map((l) => [l.id, l]))))
            .catch(() => undefined);
        }
      })
      .catch(() => setError("Error al cargar los detalles de la propiedad."))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStartShowing(leadId: number) {
    if (!property) return;
    setShowingError(null);
    try {
      const created = await startShowing({
        lead_id: leadId,
        property_id: property.id,
        agent_id: currentAgentId,
      });
      // Optimistic insertion at the top; refresh in background to confirm.
      setShowings((prev) => [created, ...prev]);
      if (!leadsById.has(leadId)) {
        await refreshShowings(property.id);
      }
      setPickerOpen(false);
    } catch (err) {
      setShowingError(err instanceof Error ? err.message : "No se pudo iniciar la visita.");
    }
  }

  async function handleEndShowing() {
    if (!activeShowing) return;
    setShowingError(null);
    const optimisticEnded = new Date().toISOString();
    const previous = showings;
    setShowings((prev) =>
      prev.map((s) => (s.id === activeShowing.id ? { ...s, ended_at: optimisticEnded } : s)),
    );
    try {
      const saved = await endShowing(activeShowing.id);
      setShowings((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
    } catch (err) {
      setShowings(previous);
      setShowingError(err instanceof Error ? err.message : "No se pudo finalizar la visita.");
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="mx-auto max-w-5xl rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-red-600">
        {error || "Propiedad no encontrada."}
        <button onClick={() => navigate("/properties")} className="ml-4 underline">Volver</button>
      </div>
    );
  }

  // Derive foot-traffic metrics from the entrance counter (room=0). Interior
  // room events (1–3) aren't double-counted here so the numbers track unique
  // visitors instead of room traversals.
  const entranceIns  = events?.filter((e) => e.room === 0 && e.event === "in")  ?? [];
  const entranceOuts = events?.filter((e) => e.room === 0 && e.event === "out") ?? [];
  const occupancy = Math.max(0, entranceIns.length - entranceOuts.length);
  const footTraffic = entranceIns.length;
  const dwellTime = computeAvgDwellMinutes(entranceIns, entranceOuts);
  const hasOpenHouse = (events?.length ?? 0) > 0;
  const latestEventTime = events && events.length > 0 ? events[events.length - 1].timestamp : undefined;
  const latestSensorTime = sensors && sensors.length > 0 ? sensors[0].created_at : undefined;
  const latestUpdate = latestEventTime ?? latestSensorTime;

  const basePrice = Number(property.price);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button 
            onClick={() => navigate("/properties")}
            className="mb-4 inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver a Propiedades
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">{property.title}</h1>
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 uppercase tracking-wider border border-blue-100">
              {property.property_type.replace('_', ' ')}
            </span>
          </div>
          <p className="mt-2 text-slate-600 flex items-center gap-1.5">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {property.location}
          </p>
        </div>
        
        <div className="flex gap-3">
          {activeShowing ? (
            <button
              onClick={handleEndShowing}
              className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-all hover:bg-emerald-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <span className="mr-2 relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
              Finalizar visita
            </button>
          ) : (
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 transition-all hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Iniciar visita
            </button>
          )}
        </div>
      </div>

      {showingError && (
        <div className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-600">
          {showingError}
        </div>
      )}

      {activeShowing && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800 flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>
            Visita en curso con{" "}
            <Link to={`/leads/${activeShowing.lead_id}`} className="font-semibold underline">
              {leadsById.get(activeShowing.lead_id)?.full_name ?? `lead #${activeShowing.lead_id}`}
            </Link>{" "}
            desde {formatRelative(activeShowing.started_at)}. La telemetría que se registre
            durante este intervalo se atribuirá a este lead.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Info Column */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
              <div className="flex items-baseline gap-2">
                <span className="text-xs uppercase tracking-wider text-slate-500">Precio</span>
                <span className="font-semibold text-slate-900 tabular-nums">${basePrice.toLocaleString()}</span>
              </div>
              <span className="h-4 w-px bg-slate-200" aria-hidden />
              <div className="flex items-baseline gap-2">
                <span className="text-xs uppercase tracking-wider text-slate-500">Agente</span>
                {agent ? (
                  <Link
                    to={`/agents/${agent.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {displayName(agent)}
                  </Link>
                ) : (
                  <Link
                    to={`/agents/${property.agent_id}`}
                    className="font-medium text-slate-500 hover:underline"
                  >
                    #{property.agent_id}
                  </Link>
                )}
              </div>
              <span className="h-4 w-px bg-slate-200" aria-hidden />
              <div className="flex items-baseline gap-2">
                <span className="text-xs uppercase tracking-wider text-slate-500">Publicado</span>
                <span className="font-medium text-slate-900">{new Date(property.created_at).toLocaleDateString()}</span>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-1.5 text-xs">
                {(() => {
                  const m = LISTING_TYPE_STYLES[property.listing_type] ?? { label: property.listing_type, cls: FALLBACK_BADGE_CLS };
                  return (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider ${m.cls}`}>
                      {m.label}
                    </span>
                  );
                })()}
                {property.legal_status && (() => {
                  const s = LEGAL_STATUS_STYLES[property.legal_status] ?? { label: property.legal_status, cls: FALLBACK_BADGE_CLS };
                  return (
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold uppercase tracking-wider ${s.cls}`}>
                      {s.label}
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Especificaciones — only render if the property has any spec data */}
          {(property.area_total_m2 != null
            || property.area_construida_m2 != null
            || property.bedrooms != null
            || property.bathrooms != null
            || property.garages != null
            || property.floors != null
            || property.year_built != null) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">📋 Especificaciones</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 text-sm">
                {property.area_total_m2 != null && (
                  <div>
                    <p className="text-slate-500">{SPEC_EMOJI.area_total_m2} Superficie total</p>
                    <p className="font-medium text-slate-900">{property.area_total_m2.toLocaleString()} m²</p>
                  </div>
                )}
                {property.area_construida_m2 != null && (
                  <div>
                    <p className="text-slate-500">{SPEC_EMOJI.area_construida_m2} Superficie construida</p>
                    <p className="font-medium text-slate-900">{property.area_construida_m2.toLocaleString()} m²</p>
                  </div>
                )}
                {property.bedrooms != null && (
                  <div>
                    <p className="text-slate-500">{SPEC_EMOJI.bedrooms} Dormitorios</p>
                    <p className="font-medium text-slate-900">{property.bedrooms}</p>
                  </div>
                )}
                {property.bathrooms != null && (
                  <div>
                    <p className="text-slate-500">{SPEC_EMOJI.bathrooms} Baños</p>
                    <p className="font-medium text-slate-900">{property.bathrooms}</p>
                  </div>
                )}
                {property.garages != null && (
                  <div>
                    <p className="text-slate-500">{SPEC_EMOJI.garages} Garajes</p>
                    <p className="font-medium text-slate-900">{property.garages}</p>
                  </div>
                )}
                {property.floors != null && (
                  <div>
                    <p className="text-slate-500">{SPEC_EMOJI.floors} Plantas</p>
                    <p className="font-medium text-slate-900">{property.floors}</p>
                  </div>
                )}
                {property.year_built != null && (
                  <div>
                    <p className="text-slate-500">{SPEC_EMOJI.year_built} Año de construcción</p>
                    <p className="font-medium text-slate-900">{property.year_built}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Servicios y amenidades — hidden if both lists are empty */}
          {(property.utilities.length > 0 || property.amenities.length > 0) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">✨ Servicios y amenidades</h2>
              <div className="space-y-4">
                {property.utilities.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">🔌 Servicios</p>
                    <div className="flex flex-wrap gap-2">
                      {property.utilities.map((u) => (
                        <span key={u} className="inline-flex items-center gap-1.5 rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                          <span aria-hidden>{emojiFor(UTILITY_EMOJI, u)}</span>
                          {u}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {property.amenities.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">🌟 Amenidades</p>
                    <div className="flex flex-wrap gap-2">
                      {property.amenities.map((a) => (
                        <span key={a} className="inline-flex items-center gap-1.5 rounded-md border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                          <span aria-hidden>{emojiFor(AMENITY_EMOJI, a)}</span>
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <ValuationCard propertyId={property.id} currentPriceHint={basePrice} />
        </div>

        {/* Live Edge Telemetry Column */}
        <div className="space-y-6">
          {/* Sensores ambientales (ESP32) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Sensores ambientales
            </h2>
            {sensors && sensors.length > 0 ? (
              <div className="space-y-3">
                {sensors.map((s) => {
                  const presenceStyle = PRESENCE_STYLES[s.presence] ?? { label: s.presence, cls: FALLBACK_BADGE_CLS };
                  return (
                    <div key={s.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-slate-900 capitalize">{s.room}</p>
                        <span className="text-xs text-slate-400">{formatRelative(s.created_at)}</span>
                      </div>
                      <div className="flex items-baseline gap-4 mb-2">
                        {s.temperature != null && (
                          <span className="text-sm">
                            <span className="text-xl font-semibold tabular-nums text-slate-800">{Number(s.temperature).toFixed(1)}</span>
                            <span className="text-slate-500 ml-0.5">°C</span>
                          </span>
                        )}
                        {s.humidity != null && (
                          <span className="text-sm">
                            <span className="text-xl font-semibold tabular-nums text-slate-800">{Number(s.humidity).toFixed(0)}</span>
                            <span className="text-slate-500 ml-0.5">%</span>
                          </span>
                        )}
                      </div>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${presenceStyle.cls}`}>
                        {presenceStyle.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Sin sensores instalados en esta propiedad.</p>
            )}
          </div>

          {/* Conteo de personas (Jetson) */}
          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-6 shadow-xl text-white">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                Telemetría edge
              </h2>
              {latestUpdate && (
                <span className="text-xs text-slate-400">{formatRelative(latestUpdate)}</span>
              )}
            </div>

            {hasOpenHouse ? (
              <div className="space-y-6">
                <div>
                  <p className="text-slate-400 text-sm mb-1">Ocupación actual</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tabular-nums text-blue-400">{occupancy}</span>
                    <span className="text-slate-500 text-sm">personas</span>
                  </div>
                </div>

                <div className="h-px w-full bg-slate-800"></div>

                <div>
                  <p className="text-slate-400 text-sm mb-1">Tráfico total</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tabular-nums text-white">{footTraffic}</span>
                    <span className="text-slate-500 text-sm">ingresos</span>
                  </div>
                </div>

                <div className="h-px w-full bg-slate-800"></div>

                <div>
                  <p className="text-slate-400 text-sm mb-1">Permanencia promedio</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tabular-nums text-white">{dwellTime.toFixed(1)}</span>
                    <span className="text-slate-500 text-sm">minutos</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Sin open houses registrados en los últimos 30 días.</p>
            )}

            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-950 rounded-lg p-2">
              <span className={`h-2 w-2 rounded-full ${hasOpenHouse ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
              Estado: {hasOpenHouse ? `Jetson/ESP32 — última lectura ${formatRelative(latestUpdate!)}` : 'Sin actividad reciente'}
            </div>
          </div>

          {/* Visitas recientes */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              Visitas recientes
            </h2>
            {showings.length === 0 ? (
              <p className="text-sm text-slate-500">
                Aún no se han registrado visitas. Usa <span className="font-medium">Iniciar visita</span> al recibir un lead.
              </p>
            ) : (
              <ul className="space-y-3">
                {showings.slice(0, 5).map((s) => {
                  const lead = leadsById.get(s.lead_id);
                  const durationMin =
                    s.ended_at != null
                      ? Math.max(
                          0,
                          (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) /
                            60000,
                        )
                      : null;
                  return (
                    <li key={s.id} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link
                          to={`/leads/${s.lead_id}`}
                          className="font-medium text-slate-900 hover:text-blue-600"
                        >
                          {lead?.full_name ?? `Lead #${s.lead_id}`}
                        </Link>
                        {s.ended_at == null ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 border border-emerald-100">
                            En curso
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500 tabular-nums">
                            {durationMin!.toFixed(0)} min
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{formatRelative(s.started_at)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Lead picker (start a showing) */}
      {pickerOpen && (
        <LeadPickerModal
          existingLeads={leadsById}
          onClose={() => setPickerOpen(false)}
          onPick={handleStartShowing}
        />
      )}

    </div>
  );
}

type LeadPickerModalProps = {
  existingLeads: Map<number, Lead>;
  onClose: () => void;
  onPick: (leadId: number) => Promise<void> | void;
};

function LeadPickerModal({ existingLeads, onClose, onPick }: LeadPickerModalProps) {
  const [leads, setLeads] = useState<Lead[] | null>(
    existingLeads.size > 0 ? Array.from(existingLeads.values()) : null,
  );
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submittingId, setSubmittingId] = useState<number | null>(null);

  useEffect(() => {
    if (leads != null) return;
    listLeads()
      .then(setLeads)
      .catch((err) => setError(err instanceof Error ? err.message : "Error al cargar leads."));
  }, [leads]);

  const q = search.trim().toLowerCase();
  const filtered = (leads ?? []).filter((l) => {
    if (!q) return true;
    return [l.full_name, l.phone ?? "", l.email ?? "", l.zonas.join(" ")]
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  async function handlePick(leadId: number) {
    setSubmittingId(leadId);
    try {
      await onPick(leadId);
    } finally {
      setSubmittingId(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Iniciar visita — elegir lead</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Cerrar"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, teléfono, email…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            autoFocus
          />

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-100 divide-y divide-slate-100">
            {leads == null && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Cargando…</div>
            )}
            {leads != null && filtered.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-slate-500">
                {leads.length === 0
                  ? "No hay leads. Crea uno desde la sección Leads."
                  : "Ningún lead coincide con la búsqueda."}
              </div>
            )}
            {filtered.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => handlePick(l.id)}
                disabled={submittingId != null}
                className="w-full px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{l.full_name}</p>
                  <p className="text-xs text-slate-500">
                    {l.phone ?? "sin teléfono"} · {l.intent}
                    {l.budget_max_usd && ` · hasta $${Number(l.budget_max_usd).toLocaleString()}`}
                  </p>
                </div>
                <span className="text-xs text-blue-600 font-medium">
                  {submittingId === l.id ? "Iniciando…" : "Iniciar →"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
