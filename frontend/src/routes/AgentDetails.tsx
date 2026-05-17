import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { displayName, getUser, type User } from "../api/users";
import { listProperties, type Property } from "../api/properties";
import { listSales, type Sale } from "../api/sales";
import { LEAD_STATUSES, listLeads, type Lead, type LeadStatus } from "../api/leads";

const OPEN_LEAD_STATUSES: ReadonlySet<LeadStatus> = new Set(
  LEAD_STATUSES.filter((s) => s !== "closed" && s !== "lost"),
);

const LISTING_TYPE_STYLES: Record<string, { label: string; cls: string }> = {
  venta: { label: "Venta", cls: "bg-blue-50 text-blue-700 border-blue-100" },
  alquiler: { label: "Alquiler", cls: "bg-amber-50 text-amber-700 border-amber-100" },
  anticretico: { label: "Anticrético", cls: "bg-violet-50 text-violet-700 border-violet-100" },
};

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return new Date(iso).toLocaleString();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d} d ago`;
  return new Date(iso).toLocaleDateString();
}

export function AgentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [agent, setAgent] = useState<User | null>(null);
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [leads, setLeads] = useState<Lead[] | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    Promise.all([
      getUser(id),
      listProperties().catch(() => [] as Property[]),
      listSales().catch(() => [] as Sale[]),
      listLeads().catch(() => [] as Lead[]),
    ])
      .then(([u, props, sls, lds]) => {
        setAgent(u);
        setProperties(props);
        setSales(sls);
        setLeads(lds);
      })
      .catch(() => setError("Failed to load agent."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 pb-12">
        <IdentitySkeleton />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <KpiSkeleton />
          <KpiSkeleton />
          <KpiSkeleton />
        </div>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="mx-auto max-w-5xl rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-red-600">
        {error || "Agent not found."}
        <button onClick={() => navigate("/agents")} className="ml-4 underline">
          Go back
        </button>
      </div>
    );
  }

  const agentId = agent.id;
  const myProperties = (properties ?? []).filter((p) => p.agent_id === agentId);
  const mySales = (sales ?? []).filter((s) => s.agent_id === agentId);
  const myLeads = (leads ?? []).filter((l) => l.agent_id === agentId);

  const salesTotal = mySales.reduce((sum, s) => sum + Number(s.amount || 0), 0);
  const leadsOpen = myLeads.filter((l) => OPEN_LEAD_STATUSES.has(l.status)).length;

  const listingByType = myProperties.reduce<Record<string, number>>((acc, p) => {
    acc[p.listing_type] = (acc[p.listing_type] ?? 0) + 1;
    return acc;
  }, {});

  const name = displayName(agent);
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <button
        onClick={() => navigate("/agents")}
        className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
      >
        <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Agents
      </button>

      {/* Identity card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start gap-5">
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xl font-semibold text-white shadow-sm">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{name}</h1>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                  agent.role === "admin"
                    ? "bg-purple-50 text-purple-700 border-purple-100"
                    : "bg-blue-50 text-blue-700 border-blue-100"
                }`}
              >
                {agent.role}
              </span>
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                  agent.active
                    ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                    : "bg-slate-100 text-slate-600 border-slate-200"
                }`}
              >
                {agent.active ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-500">@{agent.username}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <a
                href={`mailto:${agent.email}`}
                className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                {agent.email}
              </a>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600">
                Joined <span className="font-medium text-slate-900">{new Date(agent.created_at).toLocaleDateString()}</span>
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-600">
                Last seen <span className="font-medium text-slate-900">{formatRelative(agent.last_login)}</span>
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">Member #{agent.id}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* Listings */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">🏠 Active listings</p>
            <Link to="/properties" className="text-xs font-medium text-blue-600 hover:underline">
              View
            </Link>
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">{myProperties.length}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {Object.entries(listingByType).map(([type, count]) => {
              const m = LISTING_TYPE_STYLES[type] ?? { label: type, cls: "bg-slate-50 text-slate-700 border-slate-200" };
              return (
                <span
                  key={type}
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wider ${m.cls}`}
                >
                  {m.label}
                  <span className="tabular-nums">{count}</span>
                </span>
              );
            })}
            {myProperties.length === 0 && (
              <span className="text-xs text-slate-400">No listings yet.</span>
            )}
          </div>
        </div>

        {/* Sales */}
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">💼 Sales</p>
            <Link to="/sales" className="text-xs font-medium text-emerald-700 hover:underline">
              View
            </Link>
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-700 tabular-nums">
            ${salesTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <p className="mt-2 text-xs text-emerald-700/80">
            <span className="font-semibold tabular-nums">{mySales.length}</span>{" "}
            {mySales.length === 1 ? "transaction" : "transactions"} closed
          </p>
        </div>

        {/* Leads */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">👥 Leads</p>
            <Link to="/leads" className="text-xs font-medium text-blue-600 hover:underline">
              View
            </Link>
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900 tabular-nums">
            {leadsOpen}
            <span className="text-base font-medium text-slate-400"> / {myLeads.length}</span>
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-blue-500"
              style={{
                width: myLeads.length === 0 ? "0%" : `${Math.round((leadsOpen / myLeads.length) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {myLeads.length === 0 ? "No leads assigned." : `${leadsOpen} open · ${myLeads.length - leadsOpen} closed/lost`}
          </p>
        </div>
      </div>
    </div>
  );
}

function IdentitySkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start gap-5">
        <div className="h-14 w-14 animate-pulse rounded-full bg-slate-200" />
        <div className="flex-1 space-y-3">
          <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-3 w-32 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-80 max-w-full animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="h-3 w-24 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-8 w-20 animate-pulse rounded bg-slate-200" />
      <div className="mt-3 h-3 w-32 animate-pulse rounded bg-slate-100" />
    </div>
  );
}
