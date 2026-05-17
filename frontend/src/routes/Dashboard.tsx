import { useEffect, useMemo, useState } from "react";
import type { DependencyList } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  CITIES,
  RANGE_PRESETS,
  fetchCommissions,
  fetchConversionRate,
  fetchHotNeighborhoods,
  fetchInventory,
  fetchLeadsCount,
  fetchSalesOverTime,
  fetchTopAgents,
  windowKey,
  windowLabel,
  type CommissionsResponse,
  type ConversionRateResponse,
  type DashboardWindow,
  type GroupByKey,
  type HotNeighborhoodEntry,
  type InventoryResponse,
  type LeadsCountResponse,
  type SalesOverTimeResponse,
  type TopAgentEntry,
} from "../api/stats";

// Stable color palette so a given series keeps its color across range toggles.
const SERIES_COLORS = [
  "#2563eb", // blue-600
  "#7c3aed", // violet-600
  "#059669", // emerald-600
  "#d97706", // amber-600
  "#db2777", // pink-600
  "#0891b2", // cyan-600
  "#65a30d", // lime-600
  "#dc2626", // red-600
];

function colorFor(index: number): string {
  return SERIES_COLORS[index % SERIES_COLORS.length];
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function shortDate(iso: string): string {
  // "2026-05-17" → "17 may"
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("es-ES", { month: "short", day: "numeric", timeZone: "UTC" });
}

// Returns data only when it matches the current request key, so refetches show
// the skeleton instead of stale data. Avoids the react-hooks/set-state-in-effect
// pitfall of synchronously resetting state inside the effect body.
function useAsyncData<T>(
  key: string,
  fetcher: () => Promise<T>,
  deps: DependencyList,
): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>({
    key: "",
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((res) => {
        if (!cancelled) setState({ key, data: res, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setState({
            key,
            data: null,
            error: err instanceof Error ? err.message : "Solicitud fallida.",
          });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  if (state.key !== key) return { data: null, error: null };
  return { data: state.data, error: state.error };
}

const DEFAULT_WINDOW: DashboardWindow = { kind: "preset", preset: "90d" };

export function Dashboard() {
  const [window, setWindow] = useState<DashboardWindow>(DEFAULT_WINDOW);
  const wKey = windowKey(window);
  const wLabel = windowLabel(window);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <SectionTitle>Resumen</SectionTitle>
        <WindowPicker value={window} onChange={setWindow} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <InventoryCard />
        <LeadsCountCard window={window} windowKey={wKey} label={wLabel} />
        <CommissionsCard window={window} windowKey={wKey} label={wLabel} />
        <ConversionRateCard window={window} windowKey={wKey} label={wLabel} />
      </div>

      <SectionTitle className="mt-10">Ventas en el tiempo</SectionTitle>
      <div className="mt-3">
        <SalesOverTimeCard
          title="🏘️ Por tipo de propiedad"
          groupBy="property_type"
          window={window}
          windowKey={wKey}
          label={wLabel}
        />
      </div>
      <div className="mt-6">
        <SalesOverTimeCard
          title="🏷️ Por modalidad"
          groupBy="listing_type"
          window={window}
          windowKey={wKey}
          label={wLabel}
        />
      </div>

      <SectionTitle className="mt-10">Rankings</SectionTitle>
      <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
        <TopAgentsCard window={window} windowKey={wKey} label={wLabel} />
        <HotNeighborhoodsCard window={window} windowKey={wKey} label={wLabel} />
      </div>
    </div>
  );
}

function SectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 className={`text-lg font-semibold tracking-tight text-slate-900 ${className}`}>
      {children}
    </h2>
  );
}

// ────────────────────────── Window picker ──────────────────────────

function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function daysAgoIso(days: number): string {
  const now = new Date();
  now.setDate(now.getDate() - days);
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function WindowPicker({
  value,
  onChange,
}: {
  value: DashboardWindow;
  onChange: (next: DashboardWindow) => void;
}) {
  // Custom mode keeps a working copy of dates so a half-typed range doesn't
  // fire requests on every keystroke. We commit when both inputs are valid.
  const [customStart, setCustomStart] = useState<string>(() =>
    value.kind === "custom" ? value.startDate : daysAgoIso(30),
  );
  const [customEnd, setCustomEnd] = useState<string>(() =>
    value.kind === "custom" ? value.endDate : todayIso(),
  );
  const isCustom = value.kind === "custom";

  function applyCustom(nextStart: string, nextEnd: string) {
    setCustomStart(nextStart);
    setCustomEnd(nextEnd);
    if (nextStart && nextEnd && nextStart <= nextEnd) {
      onChange({ kind: "custom", startDate: nextStart, endDate: nextEnd });
    }
  }

  function switchToCustom() {
    applyCustom(customStart, customEnd);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-slate-200 bg-white/60 p-0.5">
        {RANGE_PRESETS.map((opt) => {
          const active = value.kind === "preset" && value.preset === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ kind: "preset", preset: opt.value })}
              aria-pressed={active}
              className={`min-h-[36px] min-w-[44px] rounded-md px-3 text-xs font-medium transition-colors ${
                active
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        <button
          type="button"
          onClick={switchToCustom}
          aria-pressed={isCustom}
          className={`min-h-[36px] min-w-[44px] rounded-md px-3 text-xs font-medium transition-colors ${
            isCustom
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
          title="Personalizar rango de fechas"
        >
          Personalizado
        </button>
      </div>
      {isCustom && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <input
            type="date"
            value={customStart}
            max={customEnd || undefined}
            onChange={(e) => applyCustom(e.target.value, customEnd)}
            aria-label="Fecha de inicio"
            className="min-h-[36px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <span className="text-slate-400">→</span>
          <input
            type="date"
            value={customEnd}
            min={customStart || undefined}
            max={todayIso()}
            onChange={(e) => applyCustom(customStart, e.target.value)}
            aria-label="Fecha de fin"
            className="min-h-[36px] rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      )}
    </div>
  );
}

// ────────────────────────── Inventory card ──────────────────────────

function InventoryCard() {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { data, error } = useAsyncData<InventoryResponse>("inventory", fetchInventory, []);

  const propertyTypes = useMemo(() => (data ? Object.keys(data.by_type).sort() : []), [data]);
  const count = data
    ? typeFilter === "all"
      ? data.total
      : (data.by_type[typeFilter] ?? 0)
    : 0;

  return (
    <Card>
      <CardHeader title="🏠 Propiedades disponibles" subtitle="Total en cartera" />
      {error ? (
        <ErrorBanner message={error} />
      ) : !data ? (
        <SkeletonBlock className="h-24" />
      ) : (
        <>
          <div className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{count}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            {typeFilter === "all" ? "todos los tipos" : typeFilter}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
              Todos ({data.total})
            </Chip>
            {propertyTypes.map((t) => (
              <Chip key={t} active={typeFilter === t} onClick={() => setTypeFilter(t)}>
                {t} ({data.by_type[t]})
              </Chip>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ────────────────────────── Leads count card ──────────────────────────

// Order pipeline stages in funnel-natural order regardless of API shape.
const LEAD_STATUS_ORDER: readonly string[] = [
  "new",
  "contacted",
  "visiting",
  "negotiating",
  "closed",
  "lost",
];

const LEAD_STATUS_LABELS: Record<string, string> = {
  new: "Nuevos",
  contacted: "Contactados",
  visiting: "En visita",
  negotiating: "Negociando",
  closed: "Cerrados",
  lost: "Perdidos",
};

function LeadsCountCard({
  window,
  windowKey,
  label,
}: WindowCardProps) {
  const { data, error } = useAsyncData<LeadsCountResponse>(
    `leads-count:${windowKey}`,
    () => fetchLeadsCount(window),
    [windowKey],
  );

  const breakdown = useMemo(() => {
    if (!data) return [] as { status: string; count: number }[];
    return LEAD_STATUS_ORDER
      .filter((s) => data.by_status[s])
      .map((s) => ({ status: s, count: data.by_status[s] }));
  }, [data]);

  return (
    <Card>
      <CardHeader title="👥 Clientes potenciales" subtitle={`Leads creados · ${label}`} />
      {error ? (
        <ErrorBanner message={error} />
      ) : !data ? (
        <SkeletonBlock className="h-24" />
      ) : (
        <>
          <div className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            {data.total}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            {data.open} {data.open === 1 ? "abierto" : "abiertos"}
          </div>
          {breakdown.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-sm">
              {breakdown.map(({ status, count }) => (
                <li key={status} className="flex items-center justify-between gap-3">
                  <span className="capitalize text-slate-600">
                    {LEAD_STATUS_LABELS[status] ?? status}
                  </span>
                  <span className="tabular-nums font-medium text-slate-800">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

// ────────────────────────── Commissions card ──────────────────────────

function CommissionsCard({ window, windowKey, label }: WindowCardProps) {
  const { data, error } = useAsyncData<CommissionsResponse>(
    `commissions:${windowKey}`,
    () => fetchCommissions(window),
    [windowKey],
  );

  const breakdown = useMemo(() => {
    if (!data) return [] as { kind: string; amount: number }[];
    return Object.entries(data.by_kind)
      .map(([kind, amount]) => ({ kind, amount: Number(amount) }))
      .sort((a, b) => b.amount - a.amount);
  }, [data]);

  return (
    <Card>
      <CardHeader title="💰 Comisiones generadas" subtitle={`Ingresos por corretaje · ${label}`} />
      {error ? (
        <ErrorBanner message={error} />
      ) : !data ? (
        <SkeletonBlock className="h-24" />
      ) : (
        <>
          <div className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            {usd.format(data.total_usd)}
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            {data.count} {data.count === 1 ? "venta con comisión" : "ventas con comisión"}
          </div>
          {breakdown.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-sm">
              {breakdown.map(({ kind, amount }) => (
                <li key={kind} className="flex items-center justify-between gap-3">
                  <span className="capitalize text-slate-600">{kind}</span>
                  <span className="tabular-nums font-medium text-slate-800">
                    {usd.format(amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

// ────────────────────────── Conversion rate card ──────────────────────────

function ConversionRateCard({ window, windowKey, label }: WindowCardProps) {
  const { data, error } = useAsyncData<ConversionRateResponse>(
    `conversion:${windowKey}`,
    () => fetchConversionRate(window),
    [windowKey],
  );

  return (
    <Card>
      <CardHeader title="🎯 Tasa de conversión" subtitle={`Inmuebles vendidos · ${label}`} />
      {error ? (
        <ErrorBanner message={error} />
      ) : !data ? (
        <SkeletonBlock className="h-24" />
      ) : (
        <>
          <div className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
            {(data.rate * 100).toFixed(1)}%
          </div>
          <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            {data.listings_sold} de {data.listings_total} inmuebles en venta
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all"
              style={{ width: `${Math.min(100, data.rate * 100).toFixed(1)}%` }}
              aria-hidden
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Inmuebles en venta con una "Comisión venta" cerrada en el periodo seleccionado.
          </p>
        </>
      )}
    </Card>
  );
}

// ────────────────────────── Top agents card ──────────────────────────

function TopAgentsCard({ window, windowKey, label }: WindowCardProps) {
  const { data, error } = useAsyncData<TopAgentEntry[]>(
    `top-agents:${windowKey}`,
    () => fetchTopAgents(window, 5),
    [windowKey],
  );

  return (
    <Card>
      <CardHeader title="🏆 Mejores agentes" subtitle={`Ordenados por valor de ventas · ${label}`} />
      {error ? (
        <ErrorBanner message={error} />
      ) : !data ? (
        <SkeletonList rows={5} />
      ) : data.length === 0 ? (
        <EmptyHint>Sin ventas en este periodo.</EmptyHint>
      ) : (
        <ol className="mt-3 divide-y divide-slate-100">
          {data.map((agent, i) => (
            <li
              key={agent.agent_id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                  {i + 1}
                </span>
                <span className="truncate text-sm font-medium text-slate-800">
                  {agent.full_name}
                </span>
              </div>
              <div className="flex items-center gap-3 text-right">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {agent.sales_count} ventas
                </span>
                <span className="text-sm font-semibold tabular-nums text-slate-900">
                  {usd.format(agent.sales_total_usd)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ───────────────────── Sales over time card ─────────────────────

function SalesOverTimeCard({
  title,
  groupBy,
  window,
  windowKey,
  label,
}: {
  title: string;
  groupBy: GroupByKey;
} & WindowCardProps) {
  const [showTotal, setShowTotal] = useState(true);
  const { data, error } = useAsyncData<SalesOverTimeResponse>(
    `sales-over-time:${groupBy}:${windowKey}`,
    () => fetchSalesOverTime(window, groupBy),
    [windowKey, groupBy],
  );

  const chartRows = useMemo(() => {
    if (!data) return [];
    if (showTotal) {
      return data.buckets.map((b) => ({
        date: b.date,
        total: Object.values(b.series).reduce((acc, v) => acc + Number(v), 0),
      }));
    }
    return data.buckets.map((b) => {
      const row: Record<string, number | string> = { date: b.date };
      for (const k of data.keys) row[k] = Number(b.series[k] ?? 0);
      return row;
    });
  }, [data, showTotal]);

  const grandTotal = useMemo(
    () => (data ? Object.values(data.totals).reduce((a, b) => a + Number(b), 0) : 0),
    [data],
  );

  return (
    <Card>
      <CardHeader title={title} subtitle={`${label} · ${usd.format(grandTotal)} total`}>
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            active={showTotal}
            onClick={() => setShowTotal(true)}
            ariaLabel="Mostrar la línea total agregada"
          >
            Total
          </Chip>
          <Chip
            active={!showTotal}
            onClick={() => setShowTotal(false)}
            ariaLabel="Mostrar una línea por serie"
          >
            Por serie
          </Chip>
        </div>
      </CardHeader>
      {error ? (
        <ErrorBanner message={error} />
      ) : !data ? (
        <SkeletonBlock className="mt-3 h-64" />
      ) : (
        <div className="mt-4 h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartRows} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fontSize: 11, fill: "#64748b" }}
                minTickGap={28}
              />
              <YAxis
                tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                tick={{ fontSize: 11, fill: "#64748b" }}
                width={48}
              />
              <Tooltip
                formatter={(v) => usd.format(Number(v))}
                labelFormatter={(l) => (typeof l === "string" ? shortDate(l) : String(l ?? ""))}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              {showTotal ? (
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke={SERIES_COLORS[0]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ) : (
                <>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {data.keys.map((k, i) => (
                    <Line
                      key={k}
                      type="monotone"
                      dataKey={k}
                      name={k}
                      stroke={colorFor(i)}
                      strokeWidth={1.75}
                      dot={false}
                      activeDot={{ r: 3 }}
                    />
                  ))}
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

// ───────────────────── Hot neighborhoods card ─────────────────────

function HotNeighborhoodsCard({ window, windowKey, label }: WindowCardProps) {
  const [city, setCity] = useState<string>(CITIES[0]);
  const { data, error } = useAsyncData<HotNeighborhoodEntry[]>(
    `hot-neighborhoods:${city}:${windowKey}`,
    () => fetchHotNeighborhoods(city, window, 5),
    [city, windowKey],
  );

  return (
    <Card>
      <CardHeader title="🔥 Zonas calientes" subtitle={`Zonas con mayor valor de ventas · ${label}`}>
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="min-h-[44px] rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          aria-label="Filtrar zonas por ciudad"
        >
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </CardHeader>
      {error ? (
        <ErrorBanner message={error} />
      ) : !data ? (
        <SkeletonList rows={5} />
      ) : data.length === 0 ? (
        <EmptyHint>Sin ventas registradas en {city} en el periodo.</EmptyHint>
      ) : (
        <ol className="mt-3 divide-y divide-slate-100">
          {data.map((row, i) => (
            <li key={row.zona} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-semibold text-emerald-700">
                  {i + 1}
                </span>
                <span className="truncate text-sm font-medium text-slate-800">{row.zona}</span>
              </div>
              <div className="flex items-center gap-3 text-right">
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {row.sales_count} ventas
                </span>
                <span className="text-sm font-semibold tabular-nums text-slate-900">
                  {usd.format(row.sales_total_usd)}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ─────────────────────── Shared bits ───────────────────────

type WindowCardProps = {
  window: DashboardWindow;
  windowKey: string;
  label: string;
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur">
      {children}
    </section>
  );
}

function CardHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  ariaLabel,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={`min-h-[36px] rounded-full border px-3 text-xs font-medium transition-colors ${
        active
          ? "border-blue-600 bg-blue-600 text-white"
          : "border-slate-200 bg-white/70 text-slate-600 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-100 ${className}`} />;
}

function SkeletonList({ rows }: { rows: number }) {
  return (
    <ul className="mt-3 space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-3">
          <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
          <div className="h-4 flex-1 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-16 animate-pulse rounded bg-slate-100" />
        </li>
      ))}
    </ul>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mt-3 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-sm text-red-600">
      {message}
    </div>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm text-slate-500">{children}</p>;
}
