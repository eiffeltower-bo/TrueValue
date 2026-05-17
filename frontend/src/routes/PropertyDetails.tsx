import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getProperty, type Property } from "../api/properties";

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

export function PropertyDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false);
  const [occupancy, setOccupancy] = useState(0);
  const [footTraffic, setFootTraffic] = useState(12);
  const [dwellTime, setDwellTime] = useState(4); // minutes
  const [matchmakingOpen, setMatchmakingOpen] = useState(false);

  useEffect(() => {
    async function loadProperty() {
      if (!id) return;
      try {
        setLoading(true);
        const data = await getProperty(id);
        setProperty(data);
      } catch (err) {
        setError("Failed to load property details.");
      } finally {
        setLoading(false);
      }
    }
    void loadProperty();
  }, [id]);

  // Simulation logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isSimulating) {
      interval = setInterval(() => {
        // Randomly adjust occupancy up or down
        const change = Math.random() > 0.4 ? 1 : -1;
        setOccupancy((prev) => Math.max(0, prev + change));
        
        // Foot traffic always goes up during simulation
        if (change > 0) {
          setFootTraffic((prev) => prev + 1);
        }
        
        // Dwell time fluctuates slightly
        setDwellTime((prev) => Math.max(2, prev + (Math.random() - 0.5)));
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isSimulating]);

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
        {error || "Property not found."}
        <button onClick={() => navigate("/properties")} className="ml-4 underline">Go back</button>
      </div>
    );
  }

  const basePrice = Number(property.price);
  // Dynamic valuation: increase price by 0.5% for every person in foot traffic over 10
  const trafficPremium = Math.max(0, footTraffic - 10) * 0.005;
  const dynamicValuation = basePrice * (1 + trafficPremium);
  const valueIncrease = dynamicValuation - basePrice;

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
            Back to Properties
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
          <button
            onClick={() => setMatchmakingOpen(true)}
            className="inline-flex items-center rounded-lg border border-purple-200 bg-purple-50 px-4 py-2 text-sm font-semibold text-purple-700 transition-all hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
          >
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            Find Matches (AI)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Info Column */}
        <div className="md:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Property Details</h2>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
              <div>
                <p className="text-slate-500">Listing Price</p>
                <p className="font-medium text-slate-900">${basePrice.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-slate-500">Agent ID</p>
                <p className="font-medium text-slate-900">#{property.agent_id}</p>
              </div>
              <div>
                <p className="text-slate-500">Listed On</p>
                <p className="font-medium text-slate-900">{new Date(property.created_at).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4 text-xs">
              <span className="mr-1 text-slate-500">Estado:</span>
              {(() => {
                const m = LISTING_TYPE_STYLES[property.listing_type] ?? { label: property.listing_type, cls: FALLBACK_BADGE_CLS };
                return (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold uppercase tracking-wider ${m.cls}`}>
                    {m.label}
                  </span>
                );
              })()}
              {property.legal_status && (() => {
                const s = LEGAL_STATUS_STYLES[property.legal_status] ?? { label: property.legal_status, cls: FALLBACK_BADGE_CLS };
                return (
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-semibold uppercase tracking-wider ${s.cls}`}>
                    {s.label}
                  </span>
                );
              })()}
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
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Especificaciones</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-4 gap-x-6 text-sm">
                {property.area_total_m2 != null && (
                  <div>
                    <p className="text-slate-500">Superficie total</p>
                    <p className="font-medium text-slate-900">{property.area_total_m2.toLocaleString()} m²</p>
                  </div>
                )}
                {property.area_construida_m2 != null && (
                  <div>
                    <p className="text-slate-500">Superficie construida</p>
                    <p className="font-medium text-slate-900">{property.area_construida_m2.toLocaleString()} m²</p>
                  </div>
                )}
                {property.bedrooms != null && (
                  <div>
                    <p className="text-slate-500">Dormitorios</p>
                    <p className="font-medium text-slate-900">{property.bedrooms}</p>
                  </div>
                )}
                {property.bathrooms != null && (
                  <div>
                    <p className="text-slate-500">Baños</p>
                    <p className="font-medium text-slate-900">{property.bathrooms}</p>
                  </div>
                )}
                {property.garages != null && (
                  <div>
                    <p className="text-slate-500">Garajes</p>
                    <p className="font-medium text-slate-900">{property.garages}</p>
                  </div>
                )}
                {property.floors != null && (
                  <div>
                    <p className="text-slate-500">Plantas</p>
                    <p className="font-medium text-slate-900">{property.floors}</p>
                  </div>
                )}
                {property.year_built != null && (
                  <div>
                    <p className="text-slate-500">Año de construcción</p>
                    <p className="font-medium text-slate-900">{property.year_built}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Servicios y amenidades — hidden if both lists are empty */}
          {(property.utilities.length > 0 || property.amenities.length > 0) && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Servicios y amenidades</h2>
              <div className="space-y-4">
                {property.utilities.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Servicios</p>
                    <div className="flex flex-wrap gap-2">
                      {property.utilities.map((u) => (
                        <span key={u} className="inline-flex items-center rounded-md border border-blue-100 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                          {u}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {property.amenities.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">Amenidades</p>
                    <div className="flex flex-wrap gap-2">
                      {property.amenities.map((a) => (
                        <span key={a} className="inline-flex items-center rounded-md border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dynamic Valuation Panel */}
          <div className="rounded-2xl border-2 border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <svg className="h-24 w-24 text-emerald-600" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-emerald-900 mb-2 flex items-center gap-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              Dynamic Valuation
            </h2>
            <p className="text-sm text-emerald-700 mb-6 max-w-md">
              Real-time property value estimation based on live edge sensor telemetry (foot traffic & dwell time).
            </p>
            
            <div className="flex items-end gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-emerald-600 mb-1">Current Estimated Value</p>
                <p className="text-4xl font-bold text-emerald-700 tabular-nums">
                  ${dynamicValuation.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </p>
              </div>
              {valueIncrease > 0 && (
                <div className="mb-1 flex items-center gap-1 text-sm font-semibold text-emerald-600">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                  </svg>
                  +${valueIncrease.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Edge Telemetry Column */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-6 shadow-xl text-white">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                Edge Telemetry
              </h2>
              <button 
                onClick={() => setIsSimulating(!isSimulating)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  isSimulating ? "bg-red-500/20 border-red-500/50 text-red-400 hover:bg-red-500/30" : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                }`}
              >
                {isSimulating ? "Stop Sim" : "Start Sim"}
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <p className="text-slate-400 text-sm mb-1">Current Occupancy</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums text-blue-400">{occupancy}</span>
                  <span className="text-slate-500 text-sm">people</span>
                </div>
              </div>
              
              <div className="h-px w-full bg-slate-800"></div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Today's Foot Traffic</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums text-white">{footTraffic}</span>
                  <span className="text-slate-500 text-sm">total entries</span>
                </div>
              </div>

              <div className="h-px w-full bg-slate-800"></div>

              <div>
                <p className="text-slate-400 text-sm mb-1">Avg. Dwell Time</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold tabular-nums text-white">{dwellTime.toFixed(1)}</span>
                  <span className="text-slate-500 text-sm">minutes</span>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500 bg-slate-950 rounded-lg p-2">
              <span className={`h-2 w-2 rounded-full ${isSimulating ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></span>
              Status: {isSimulating ? 'Receiving Live Data (Jetson/ESP32)' : 'Idle'}
            </div>
          </div>
        </div>
      </div>

      {/* Smart Matchmaking Modal */}
      {matchmakingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMatchmakingOpen(false)}></div>
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-slate-100 bg-purple-50/50 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
                <svg className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                AI Smart Matchmaking
              </h2>
              <button onClick={() => setMatchmakingOpen(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                <p><strong>Context provided to AI:</strong> Property <span className="text-slate-900 font-medium">#{property.id} ({property.title})</span> has seen high foot traffic ({footTraffic} today) with an average dwell time of {dwellTime.toFixed(1)} mins. Generating ideal buyer/tenant profiles...</p>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-slate-900">Recommended Matches</h3>
                
                <div className="rounded-xl border border-purple-100 bg-white p-4 shadow-sm hover:border-purple-300 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-purple-900">Boutique Coffee Shop Franchise</h4>
                      <p className="text-sm text-slate-500 mt-1">High fit score due to short, frequent dwell times ({dwellTime.toFixed(1)}m) and high daily traffic.</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">
                      98% Match
                    </span>
                  </div>
                  <button className="mt-4 rounded-lg bg-purple-100 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-200 transition-colors">
                    Generate Pitch Email
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-slate-300 transition-colors">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-slate-900">Co-working Space Operator</h4>
                      <p className="text-sm text-slate-500 mt-1">Moderate fit. Requires longer dwell times, but the location's high traffic is attractive.</p>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
                      75% Match
                    </span>
                  </div>
                  <button className="mt-4 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 transition-colors">
                    Generate Pitch Email
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
