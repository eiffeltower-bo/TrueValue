import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  LEAD_INTENTS,
  LEAD_STATUSES,
  createLead,
  listLeads,
  type Lead,
  type LeadIntent,
  type LeadStatus,
} from "../api/leads";
import { displayName, listUsers, type User } from "../api/users";
import { SortableHeader, useSort, useSorted } from "./tableUtils";

type LeadSortKey = "id" | "full_name" | "intent" | "status" | "budget" | "agent";

const STATUS_STYLES: Record<LeadStatus, { label: string; cls: string }> = {
  new:         { label: "Nuevo",       cls: "bg-blue-50 text-blue-700 border-blue-100" },
  contacted:   { label: "Contactado",  cls: "bg-indigo-50 text-indigo-700 border-indigo-100" },
  visiting:    { label: "Visitando",   cls: "bg-violet-50 text-violet-700 border-violet-100" },
  negotiating: { label: "Negociando",  cls: "bg-amber-50 text-amber-700 border-amber-100" },
  closed:      { label: "Cerrado",     cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  lost:        { label: "Perdido",     cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

const INTENT_STYLES: Record<LeadIntent, { label: string; cls: string }> = {
  venta:       { label: "Venta",       cls: "bg-blue-50 text-blue-700 border-blue-100" },
  alquiler:    { label: "Alquiler",    cls: "bg-amber-50 text-amber-700 border-amber-100" },
  anticretico: { label: "Anticrético", cls: "bg-violet-50 text-violet-700 border-violet-100" },
};

function formatBudget(min: string | null, max: string | null): string {
  const f = (v: string) => `$${Number(v).toLocaleString()}`;
  if (min && max) return `${f(min)} – ${f(max)}`;
  if (max) return `≤ ${f(max)}`;
  if (min) return `≥ ${f(min)}`;
  return "—";
}

export function Leads() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<Map<number, User>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | LeadStatus>("all");
  const { sort, toggle } = useSort<LeadSortKey>({ key: "id", dir: "asc" });

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      const [leadsData, users] = await Promise.all([
        listLeads(),
        listUsers().catch(() => [] as User[]),
      ]);
      setItems(leadsData);
      setAgents(new Map(users.map((u) => [u.id, u])));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load leads.");
    } finally {
      setLoading(false);
    }
  }

  const agentLabel = (agentId: number | null) => {
    if (agentId == null) return "—";
    const a = agents.get(agentId);
    return a ? displayName(a) : `#${agentId}`;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((l) => {
      if (statusFilter !== "all" && l.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [l.full_name, l.phone ?? "", l.email ?? "", l.zonas.join(" ")]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search, statusFilter]);

  const sorted = useSorted(filtered, sort, (l, key) => {
    switch (key) {
      case "id": return l.id;
      case "full_name": return l.full_name;
      case "intent": return l.intent;
      case "status": return l.status;
      case "budget": return Number(l.budget_max_usd ?? l.budget_min_usd ?? 0);
      case "agent": return agentLabel(l.agent_id);
    }
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500 mt-1">Prospective buyers and renters</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Lead
        </button>
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
            placeholder="Search name, phone, email, zona…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | LeadStatus)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">All statuses</option>
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_STYLES[s].label}
            </option>
          ))}
        </select>
        <span className="text-xs text-slate-500">{sorted.length} of {items.length}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500">
              <tr>
                <SortableHeader<LeadSortKey> label="ID" sortKey="id" sort={sort} onToggle={toggle} />
                <SortableHeader<LeadSortKey> label="Name" sortKey="full_name" sort={sort} onToggle={toggle} />
                <SortableHeader<LeadSortKey> label="Intent" sortKey="intent" sort={sort} onToggle={toggle} />
                <SortableHeader<LeadSortKey> label="Budget" sortKey="budget" sort={sort} onToggle={toggle} align="right" />
                <SortableHeader<LeadSortKey> label="Status" sortKey="status" sort={sort} onToggle={toggle} />
                <SortableHeader<LeadSortKey> label="Agent" sortKey="agent" sort={sort} onToggle={toggle} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"></div>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <svg className="mb-3 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 0a4 4 0 11-8 0 4 4 0 018 0z" />
                      </svg>
                      No leads yet. Click "New Lead" to add one.
                    </div>
                  </td>
                </tr>
              )}
              {!loading && items.length > 0 && sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                    No leads match the current filters.
                  </td>
                </tr>
              )}
              {!loading &&
                sorted.map((l) => {
                  const statusStyle = STATUS_STYLES[l.status];
                  const intentStyle = INTENT_STYLES[l.intent];
                  return (
                    <tr
                      key={l.id}
                      onClick={() => navigate(`/leads/${l.id}`)}
                      className="transition-colors hover:bg-slate-50 cursor-pointer"
                    >
                      <td className="whitespace-nowrap px-6 py-4 text-slate-500">#{l.id}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">
                        {l.full_name}
                        {l.phone && <div className="text-xs text-slate-500">{l.phone}</div>}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${intentStyle.cls}`}>
                          {intentStyle.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-slate-700 tabular-nums">
                        {formatBudget(l.budget_min_usd, l.budget_max_usd)}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${statusStyle.cls}`}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-700">{agentLabel(l.agent_id)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <NewLeadModal
          onClose={() => setModalOpen(false)}
          onCreated={(created) => {
            setItems((prev) => [...prev, created]);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

type NewLeadModalProps = {
  onClose: () => void;
  onCreated: (l: Lead) => void;
};

function NewLeadModal({ onClose, onCreated }: NewLeadModalProps) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [intent, setIntent] = useState<LeadIntent>("venta");
  const [budgetMax, setBudgetMax] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await createLead({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        intent,
        budget_max_usd: budgetMax ? Number(budgetMax) : null,
      });
      onCreated(created);
    } catch (err) {
      if (err instanceof ApiError) setError(`${err.status}: ${err.message}`);
      else if (err instanceof Error) setError(err.message);
      else setError("Failed to create lead.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">New Lead</h2>
        </div>

        <div className="p-6 space-y-5">
          <Field label="Full name">
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputCls}
              placeholder="e.g. María Pérez"
            />
          </Field>

          <Field label="Phone">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
              placeholder="+591 7XX XXX XXX"
              inputMode="tel"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Intent">
              <select
                value={intent}
                onChange={(e) => setIntent(e.target.value as LeadIntent)}
                className={inputCls}
              >
                {LEAD_INTENTS.map((i) => (
                  <option key={i} value={i}>
                    {INTENT_STYLES[i].label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Budget max (USD)">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-slate-500 sm:text-sm">$</span>
                </div>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  className={`${inputCls} pl-7`}
                  placeholder="0"
                />
              </div>
            </Field>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 bg-slate-50/50 px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {submitting ? "Saving…" : "Create Lead"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
