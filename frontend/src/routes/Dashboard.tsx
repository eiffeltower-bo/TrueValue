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
  RANGE_OPTIONS,
  fetchCommissions,
  fetchConversionRate,
  fetchHotNeighborhoods,
  fetchInventory,
  fetchSalesOverTime,
  fetchTopAgents,
  type CommissionsResponse,
  type ConversionRateResponse,
  type GroupByKey,
  type HotNeighborhoodEntry,
  type InventoryResponse,
  type RangeKey,
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
  // "2026-05-17" → "May 17"
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
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
            error: err instanceof Error ? err.message : "Request failed.",
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

export function Dashboard() {
  return (
    <div className="mx-auto max-w-5xl">
      <SectionTitle>Overview</SectionTitle>
      <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <InventoryCard />
        <CommissionsCard />
        <ConversionRateCard />
      </div>

      <SectionTitle className="mt-10">Sales over time</SectionTitle>
      <div className="mt-3">
        <SalesOverTimeCard title="By property type" groupBy="property_type" />
      </div>
      <div className="mt-6">
        <SalesOverTimeCard title="By listing type" groupBy="listing_type" />
      </div>

      <SectionTitle className="mt-10">Rankings</SectionTitle>
      <div className="mt-3 grid grid-cols-1 gap-6 md:grid-cols-2">
        <TopAgentsCard />
        <HotNeighborhoodsCard />
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
      <CardHeader title="Available properties" subtitle="Total in inventory" />
      {error ? (
        <ErrorBanner message={error} />
      ) : !data ? (
        <SkeletonBlock className="h-24" />
      ) : (
        <>
          <div className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{count}</div>
          <div className="mt-1 text-xs uppercase tracking-wide text-slate-400">
            {typeFilter === "all" ? "all types" : typeFilter}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Chip active={typeFilter === "all"} onClick={() => setTypeFilter("all")}>
              All ({data.total})
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

// ────────────────────────── Commissions card ──────────────────────────

function CommissionsCard() {
  const [range, setRange] = useState<RangeKey>("90d");
  const { data, error } = useAsyncData<CommissionsResponse>(
    `commissions:${range}`,
    () => fetchCommissions(range),
    [range],
  );

  const breakdown = useMemo(() => {
    if (!data) return [] as { kind: string; amount: number }[];
    return Object.entries(data.by_kind)
      .map(([kind, amount]) => ({ kind, amount: Number(amount) }))
      .sort((a, b) => b.amount - a.amount);
  }, [data]);

  return (
    <Card>
      <CardHeader title="Commissions earned" subtitle={`Brokerage income · ${range}`}>
        <RangeToggle value={range} onChange={setRange} />
      </CardHeader>
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
            {data.count} commission {data.count === 1 ? "sale" : "sales"}
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

function ConversionRateCard() {
  const [range, setRange] = useState<RangeKey>("90d");
  const { data, error } = useAsyncData<ConversionRateResponse>(
    `conversion:${range}`,
    () => fetchConversionRate(range),
    [range],
  );

  return (
    <Card>
      <CardHeader title="Conversion rate" subtitle={`Listings closed · ${range}`}>
        <RangeToggle value={range} onChange={setRange} />
      </CardHeader>
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
            {data.listings_sold} of {data.listings_total} for-sale listings
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all"
              style={{ width: `${Math.min(100, data.rate * 100).toFixed(1)}%` }}
              aria-hidden
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Listings (venta) with a closed “Comisión venta” sale in the selected window.
          </p>
        </>
      )}
    </Card>
  );
}

// ────────────────────────── Top agents card ──────────────────────────

function TopAgentsCard() {
  const [range, setRange] = useState<RangeKey>("90d");
  const { data, error } = useAsyncData<TopAgentEntry[]>(
    `top-agents:${range}`,
    () => fetchTopAgents(range, 5),
    [range],
  );

  return (
    <Card>
      <CardHeader title="Top agents" subtitle={`Ranked by sales value · ${range}`}>
        <RangeToggle value={range} onChange={setRange} />
      </CardHeader>
      {error ? (
        <ErrorBanner message={error} />
      ) : !data ? (
        <SkeletonList rows={5} />
      ) : data.length === 0 ? (
        <EmptyHint>No sales in this window.</EmptyHint>
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
                  {agent.sales_count} sales
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
}: {
  title: string;
  groupBy: GroupByKey;
}) {
  const [range, setRange] = useState<RangeKey>("90d");
  const [showTotal, setShowTotal] = useState(true);
  const { data, error } = useAsyncData<SalesOverTimeResponse>(
    `sales-over-time:${groupBy}:${range}`,
    () => fetchSalesOverTime(range, groupBy),
    [range, groupBy],
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
      <CardHeader title={title} subtitle={`Last ${range} · ${usd.format(grandTotal)} total`}>
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            active={showTotal}
            onClick={() => setShowTotal(true)}
            ariaLabel="Show aggregated total line"
          >
            Total
          </Chip>
          <Chip
            active={!showTotal}
            onClick={() => setShowTotal(false)}
            ariaLabel="Show one line per series"
          >
            By series
          </Chip>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          <RangeToggle value={range} onChange={setRange} />
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

function HotNeighborhoodsCard() {
  const [city, setCity] = useState<string>(CITIES[0]);
  const { data, error } = useAsyncData<HotNeighborhoodEntry[]>(
    `hot-neighborhoods:${city}`,
    () => fetchHotNeighborhoods(city, "90d", 5),
    [city],
  );

  return (
    <Card>
      <CardHeader title="Hot neighborhoods" subtitle="Top zonas by 90d sales value">
        <select
          value={city}
          onChange={(e) => setCity(e.target.value)}
          className="min-h-[44px] rounded-lg border border-slate-200 bg-white/70 px-3 py-2 text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          aria-label="Filter neighborhoods by city"
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
        <EmptyHint>No sales recorded for {city} in the last 90 days.</EmptyHint>
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
                  {row.sales_count} sales
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

function RangeToggle({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (next: RangeKey) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-200 bg-white/60 p-0.5">
      {RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`min-h-[36px] min-w-[44px] rounded-md px-3 text-xs font-medium transition-colors ${
            value === opt.value
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {opt.label}
        </button>
      ))}
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
