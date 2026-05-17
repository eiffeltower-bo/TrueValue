import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { displayName, listUsers, type User } from "../api/users";
import { listProperties, type Property } from "../api/properties";
import { listSales, type Sale } from "../api/sales";
import { LEAD_STATUSES, listLeads, type Lead, type LeadStatus } from "../api/leads";
import { SortableHeader, useSort, useSorted } from "./tableUtils";

type AgentSortKey =
  | "id"
  | "name"
  | "username"
  | "role"
  | "listings"
  | "sales_count"
  | "sales_total"
  | "leads"
  | "joined";

type AgentRow = {
  user: User;
  listings: number;
  sales_count: number;
  sales_total_usd: number;
  leads_open: number;
  leads_total: number;
};

const OPEN_LEAD_STATUSES: ReadonlySet<LeadStatus> = new Set(
  LEAD_STATUSES.filter((s) => s !== "closed" && s !== "lost"),
);

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
      setLoadError(err instanceof Error ? err.message : "Failed to load agents.");
    } finally {
      setLoading(false);
    }
  }

  const rows: AgentRow[] = useMemo(() => {
    const byAgent = new Map<number, { listings: number; sales_count: number; sales_total: number; leads_open: number; leads_total: number }>();
    const ensure = (id: number) => {
      let v = byAgent.get(id);
      if (!v) {
        v = { listings: 0, sales_count: 0, sales_total: 0, leads_open: 0, leads_total: 0 };
        byAgent.set(id, v);
      }
      return v;
    };
    for (const p of properties) ensure(p.agent_id).listings += 1;
    for (const s of sales) {
      const v = ensure(s.agent_id);
      v.sales_count += 1;
      v.sales_total += Number(s.amount || 0);
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
      case "leads": return r.leads_open;
      case "joined": return r.user.created_at;
    }
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Agents</h1>
        <p className="text-sm text-slate-500 mt-1">Team performance at a glance</p>
      </div>

      {loadError && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-600">
          {loadError}
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[12rem]">
          <svg className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 110-16 8 8 0 010 16z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, username, email…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as "all" | "agent" | "admin")}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All roles</option>
          <option value="agent">Agent</option>
          <option value="admin">Admin</option>
        </select>
        <span className="text-xs text-slate-500">{sorted.length} of {rows.length}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500">
              <tr>
                <SortableHeader<AgentSortKey> label="ID" sortKey="id" sort={sort} onToggle={toggle} />
                <SortableHeader<AgentSortKey> label="Name" sortKey="name" sort={sort} onToggle={toggle} />
                <SortableHeader<AgentSortKey> label="Username" sortKey="username" sort={sort} onToggle={toggle} />
                <SortableHeader<AgentSortKey> label="Role" sortKey="role" sort={sort} onToggle={toggle} />
                <SortableHeader<AgentSortKey> label="Listings" sortKey="listings" sort={sort} onToggle={toggle} align="right" />
                <SortableHeader<AgentSortKey> label="Sales" sortKey="sales_count" sort={sort} onToggle={toggle} align="right" />
                <SortableHeader<AgentSortKey> label="Sales $" sortKey="sales_total" sort={sort} onToggle={toggle} align="right" />
                <SortableHeader<AgentSortKey> label="Leads" sortKey="leads" sort={sort} onToggle={toggle} align="right" />
                <SortableHeader<AgentSortKey> label="Joined" sortKey="joined" sort={sort} onToggle={toggle} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={`sk-${i}`}>
                    <td colSpan={9} className="px-6 py-3">
                      <div className="h-6 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">
                    No agents yet.
                  </td>
                </tr>
              )}
              {!loading && rows.length > 0 && sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-sm text-slate-500">
                    No agents match the current filters.
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
                          {r.user.role}
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
