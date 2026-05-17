import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { displayName, listUsers, type User } from "../api/users";
import { listProperties, type Property } from "../api/properties";
import { listSales, type Sale } from "../api/sales";
import { LEAD_STATUSES, listLeads, type Lead, type LeadStatus } from "../api/leads";
import { isCommissionSale } from "../lib/sales";
import { SortableHeader, useSort, useSorted } from "./tableUtils";

type AgentSortKey =
  | "id"
  | "name"
  | "username"
  | "role"
  | "listings"
  | "sales_count"
  | "sales_total"
  | "commissions"
  | "leads"
  | "joined";

type AgentRow = {
  user: User;
  listings: number;
  sales_count: number;
  sales_total_usd: number;
  commissions_total_usd: number;
  leads_open: number;
  leads_total: number;
};

const OPEN_LEAD_STATUSES: ReadonlySet<LeadStatus> = new Set(
  LEAD_STATUSES.filter((s) => s !== "closed" && s !== "lost"),
);

// Color palette for the trend chart — same as Dashboard for consistency.
const TREND_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#db2777",
  "#0891b2",
];

const TREND_RANGES = [
  { value: "30d", label: "30d", days: 30 },
  { value: "90d", label: "90d", days: 90 },
  { value: "365d", label: "1a", days: 365 },
] as const;
type TrendRange = (typeof TREND_RANGES)[number]["value"];

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function shortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("es-ES", { month: "short", day: "numeric", timeZone: "UTC" });
}

function isoDay(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function Agents() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "agent" | "admin">("all");
  const [trendRange, setTrendRange] = useState<TrendRange>("90d");
  const { sort, toggle } = useSort<AgentSortKey>({ key: "sales_total", dir: "desc" });

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      const [us, ps, ss, ls] = await Promise.all([
        listUsers(),
        listProperties().catch(() => [] as Property[]),
        listSales().catch(() => [] as Sale[]),
        listLeads().catch(() => [] as Lead[]),
      ]);
      setUsers(us);
      setProperties(ps);
      setSales(ss);
      setLeads(ls);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar agentes.");
    } finally {
      setLoading(false);
    }
  }

  const rows: AgentRow[] = useMemo(() => {
    const byAgent = new Map<
      number,
      {
        listings: number;
        sales_count: number;
        sales_total: number;
        commissions_total: number;
        leads_open: number;
        leads_total: number;
      }
    >();
    const ensure = (id: number) => {
      let v = byAgent.get(id);
      if (!v) {
        v = {
          listings: 0,
          sales_count: 0,
          sales_total: 0,
          commissions_total: 0,
          leads_open: 0,
          leads_total: 0,
        };
        byAgent.set(id, v);
      }
      return v;
    };
    for (const p of properties) ensure(p.agent_id).listings += 1;
    for (const s of sales) {
      const v = ensure(s.agent_id);
      const amount = Number(s.amount || 0);
      v.sales_count += 1;
      v.sales_total += amount;
      if (isCommissionSale(s.product_or_service)) v.commissions_total += amount;
    }
    for (const l of leads) {
      if (l.agent_id == null) continue;
      const v = ensure(l.agent_id);
      v.leads_total += 1;
      if (OPEN_LEAD_STATUSES.has(l.status)) v.leads_open += 1;
    }
    return users.map((u) => {
      const v = byAgent.get(u.id);
      return {
        user: u,
        listings: v?.listings ?? 0,
        sales_count: v?.sales_count ?? 0,
        sales_total_usd: v?.sales_total ?? 0,
        commissions_total_usd: v?.commissions_total ?? 0,
        leads_open: v?.leads_open ?? 0,
        leads_total: v?.leads_total ?? 0,
      };
    });
  }, [users, properties, sales, leads]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (roleFilter !== "all" && r.user.role !== roleFilter) return false;
      if (!q) return true;
      const haystack = [displayName(r.user), r.user.username, r.user.email]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, roleFilter]);

  const sorted = useSorted(filtered, sort, (r, key) => {
    switch (key) {
      case "id": return r.user.id;
      case "name": return displayName(r.user);
      case "username": return r.user.username;
      case "role": return r.user.role;
      case "listings": return r.listings;
      case "sales_count": return r.sales_count;
      case "sales_total": return r.sales_total_usd;
      case "commissions": return r.commissions_total_usd;
      case "leads": return r.leads_open;
      case "joined": return r.user.created_at;
    }
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Agentes</h1>
        <p className="text-sm text-slate-500 mt-1">Desempeño del equipo de un vistazo</p>
      </div>

      {loadError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-600">
          {loadError}
        </div>
      )}

      <SalesTrendChart
        sales={sales}
        users={users}
        loading={loading}
        range={trendRange}
        onRangeChange={setTrendRange}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[12rem]">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, usuario, email…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as "all" | "agent" | "admin")}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">Todos los roles</option>
          <option value="agent">Agente</option>
          <option value="admin">Admin</option>
        </select>
        <span className="text-xs text-slate-500">{sorted.length} de {rows.length}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500">
              <tr>
                <SortableHeader<AgentSortKey> label="ID" sortKey="id" sort={sort} onToggle={toggle} />
                <SortableHeader<AgentSortKey> label="Nombre" sortKey="name" sort={sort} onToggle={toggle} />
                <SortableHeader<AgentSortKey> label="Usuario" sortKey="username" sort={sort} onToggle={toggle} />
                <SortableHeader<AgentSortKey> label="Rol" sortKey="role" sort={sort} onToggle={toggle} />
                <SortableHeader<AgentSortKey> label="Inmuebles" sortKey="listings" sort={sort} onToggle={toggle} align="right" />
                <SortableHeader<AgentSortKey> label="Ventas" sortKey="sales_count" sort={sort} onToggle={toggle} align="right" />
                <SortableHeader<AgentSortKey> label="Ventas $" sortKey="sales_total" sort={sort} onToggle={toggle} align="right" />
                <SortableHeader<AgentSortKey> label="Comisiones $" sortKey="commissions" sort={sort} onToggle={toggle} align="right" />
                <SortableHeader<AgentSortKey> label="Leads" sortKey="leads" sort={sort} onToggle={toggle} align="right" />
                <SortableHeader<AgentSortKey> label="Ingreso" sortKey="joined" sort={sort} onToggle={toggle} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td colSpan={10} className="px-6 py-3">
                      <div className="h-6 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm text-slate-500">
                    Aún no hay agentes.
                  </td>
                </tr>
              )}
              {!loading && rows.length > 0 && sorted.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-sm text-slate-500">
                    Ningún agente coincide con los filtros.
                  </td>
                </tr>
              )}
              {!loading &&
                sorted.map((r) => {
                  const name = displayName(r.user);
                  return (
                    <tr
                      key={r.user.id}
                      onClick={() => navigate(`/agents/${r.user.id}`)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-slate-500">#{r.user.id}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-slate-900">{name}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-600">@{r.user.username}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                            r.user.role === "admin"
                              ? "bg-purple-50 text-purple-700 border-purple-100"
                              : "bg-blue-50 text-blue-700 border-blue-100"
                          }`}
                        >
                          {r.user.role === "admin" ? "Admin" : "Agente"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums text-slate-900">
                        {r.listings}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums text-slate-900">
                        {r.sales_count}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums font-medium text-emerald-600">
                        ${r.sales_total_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums font-medium text-amber-700">
                        ${r.commissions_total_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right tabular-nums text-slate-900">
                        {r.leads_open}
                        <span className="text-slate-400"> / {r.leads_total}</span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-500 text-xs">
                        {new Date(r.user.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── Sales trend by agent (top 5) ───────────────────

function SalesTrendChart({
  sales,
  users,
  loading,
  range,
  onRangeChange,
}: {
  sales: Sale[];
  users: User[];
  loading: boolean;
  range: TrendRange;
  onRangeChange: (next: TrendRange) => void;
}) {
  const days = TREND_RANGES.find((r) => r.value === range)!.days;

  const { chartRows, lines, total, hasData } = useMemo(() => {
    const now = new Date();
    const startMs = now.getTime() - days * 24 * 60 * 60 * 1000;
    const inWindow = sales.filter((s) => {
      const t = new Date(s.sold_at).getTime();
      return t >= startMs;
    });
    if (inWindow.length === 0) {
      return { chartRows: [], lines: [], total: 0, hasData: false };
    }

    // Aggregate per-agent totals over the window to pick the top 5.
    const perAgentTotal = new Map<number, number>();
    for (const s of inWindow) {
      perAgentTotal.set(s.agent_id, (perAgentTotal.get(s.agent_id) ?? 0) + Number(s.amount || 0));
    }
    const top = [...perAgentTotal.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id);
    const topSet = new Set(top);
    const userById = new Map(users.map((u) => [u.id, u]));

    // Build day-by-day buckets for the continuous axis.
    const startDay = new Date(now);
    startDay.setUTCHours(0, 0, 0, 0);
    startDay.setUTCDate(startDay.getUTCDate() - (days - 1));
    const buckets: { date: string; [k: string]: number | string }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDay);
      d.setUTCDate(startDay.getUTCDate() + i);
      const row: { date: string; [k: string]: number | string } = { date: isoDay(d) };
      for (const aid of top) row[`a${aid}`] = 0;
      buckets.push(row);
    }
    const byDate = new Map(buckets.map((b) => [b.date, b]));
    for (const s of inWindow) {
      if (!topSet.has(s.agent_id)) continue;
      const day = isoDay(new Date(s.sold_at));
      const bucket = byDate.get(day);
      if (!bucket) continue;
      const k = `a${s.agent_id}`;
      bucket[k] = Number(bucket[k] ?? 0) + Number(s.amount || 0);
    }

    const lines = top.map((aid, i) => {
      const u = userById.get(aid);
      return {
        key: `a${aid}`,
        name: u ? displayName(u) : `Agente #${aid}`,
        color: TREND_COLORS[i % TREND_COLORS.length],
      };
    });
    const totalUsd = inWindow.reduce((acc, s) => acc + Number(s.amount || 0), 0);
    return { chartRows: buckets, lines, total: totalUsd, hasData: true };
  }, [sales, users, days]);

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Tendencia de ventas
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Top 5 agentes · {usd.format(total)} total · últimos {range}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white/60 p-0.5">
          {TREND_RANGES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onRangeChange(opt.value)}
              aria-pressed={range === opt.value}
              className={`min-h-[36px] min-w-[44px] rounded-md px-3 text-xs font-medium transition-colors ${
                range === opt.value
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="mt-4 h-56 w-full animate-pulse rounded-lg bg-slate-100" />
      ) : !hasData ? (
        <p className="mt-6 text-sm text-slate-500">Sin ventas registradas en este periodo.</p>
      ) : (
        <div className="mt-4 h-56 w-full">
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
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {lines.map((ln) => (
                <Line
                  key={ln.key}
                  type="monotone"
                  dataKey={ln.key}
                  name={ln.name}
                  stroke={ln.color}
                  strokeWidth={1.75}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
