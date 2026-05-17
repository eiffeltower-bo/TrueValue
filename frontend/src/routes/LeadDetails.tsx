import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError } from "../api/client";
import {
  LEAD_INTENTS,
  LEAD_SOURCES,
  LEAD_STATUSES,
  getLead,
  updateLead,
  type Lead,
  type LeadIntent,
  type LeadSource,
  type LeadStatus,
} from "../api/leads";
import { displayName, getUser, listUsers, type User } from "../api/users";
import { listProperties, type Property } from "../api/properties";
import { listShowings, type Showing } from "../api/showings";
import { LeadScoreCard } from "../components/LeadScoreCard";
import { MatchmakingPanel } from "../components/MatchmakingPanel";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  visiting: "Visitando",
  negotiating: "Negociando",
  closed: "Cerrado",
  lost: "Perdido",
};

const INTENT_LABEL: Record<LeadIntent, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  anticretico: "Anticrético",
};

const SOURCE_LABEL: Record<LeadSource, string> = {
  walk_in: "Walk-in",
  referral: "Referido",
  web: "Web",
  open_house: "Open House",
  other: "Otro",
};

// Comma-separated string ⇄ string[]
function splitList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function LeadDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [lead, setLead] = useState<Lead | null>(null);
  const [agent, setAgent] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [showings, setShowings] = useState<Showing[]>([]);
  const [propertiesById, setPropertiesById] = useState<Map<number, Property>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Edit form state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [form, setForm] = useState<{
    full_name: string;
    phone: string;
    email: string;
    source: LeadSource;
    agent_id: string;
    status: LeadStatus;
    intent: LeadIntent;
    budget_min: string;
    budget_max: string;
    bedrooms_min: string;
    area_min_m2: string;
    zonas: string;
    must_haves: string;
    notes: string;
  } | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    Promise.all([
      getLead(id),
      listUsers().catch(() => [] as User[]),
      listShowings({ lead_id: Number(id) }).catch(() => [] as Showing[]),
    ])
      .then(([leadData, userList, showingList]) => {
        setLead(leadData);
        setUsers(userList);
        setShowings(showingList);
        if (leadData.agent_id != null) {
          getUser(leadData.agent_id).then(setAgent).catch(() => setAgent(null));
        }
        if (showingList.length > 0) {
          listProperties()
            .then((props) => setPropertiesById(new Map(props.map((p) => [p.id, p]))))
            .catch(() => undefined);
        }
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Error al cargar el lead."))
      .finally(() => setLoading(false));
  }, [id]);

  function startEdit() {
    if (!lead) return;
    setForm({
      full_name: lead.full_name,
      phone: lead.phone ?? "",
      email: lead.email ?? "",
      source: lead.source,
      agent_id: lead.agent_id?.toString() ?? "",
      status: lead.status,
      intent: lead.intent,
      budget_min: lead.budget_min_usd ?? "",
      budget_max: lead.budget_max_usd ?? "",
      bedrooms_min: lead.bedrooms_min?.toString() ?? "",
      area_min_m2: lead.area_min_m2?.toString() ?? "",
      zonas: lead.zonas.join(", "),
      must_haves: lead.must_haves.join(", "),
      notes: lead.notes,
    });
    setSaveError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setForm(null);
    setSaveError(null);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || !lead) return;
    setSaving(true);
    setSaveError(null);

    // Optimistic UI: apply locally, fire request, roll back on failure
    const optimistic: Lead = {
      ...lead,
      full_name: form.full_name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      source: form.source,
      agent_id: form.agent_id ? Number(form.agent_id) : null,
      status: form.status,
      intent: form.intent,
      budget_min_usd: form.budget_min || null,
      budget_max_usd: form.budget_max || null,
      bedrooms_min: form.bedrooms_min ? Number(form.bedrooms_min) : null,
      area_min_m2: form.area_min_m2 ? Number(form.area_min_m2) : null,
      zonas: splitList(form.zonas),
      must_haves: splitList(form.must_haves),
      notes: form.notes,
    };
    const previous = lead;
    setLead(optimistic);
    setEditing(false);

    try {
      const saved = await updateLead(lead.id, {
        full_name: optimistic.full_name,
        phone: optimistic.phone,
        email: optimistic.email,
        source: optimistic.source,
        agent_id: optimistic.agent_id,
        status: optimistic.status,
        intent: optimistic.intent,
        budget_min_usd: optimistic.budget_min_usd ? Number(optimistic.budget_min_usd) : null,
        budget_max_usd: optimistic.budget_max_usd ? Number(optimistic.budget_max_usd) : null,
        bedrooms_min: optimistic.bedrooms_min,
        area_min_m2: optimistic.area_min_m2,
        zonas: optimistic.zonas,
        must_haves: optimistic.must_haves,
        notes: optimistic.notes,
      });
      setLead(saved);
      if (saved.agent_id != null && saved.agent_id !== agent?.id) {
        getUser(saved.agent_id).then(setAgent).catch(() => setAgent(null));
      } else if (saved.agent_id == null) {
        setAgent(null);
      }
    } catch (err) {
      setLead(previous);
      setEditing(true);
      if (err instanceof ApiError) setSaveError(`${err.status}: ${err.message}`);
      else if (err instanceof Error) setSaveError(err.message);
      else setSaveError("No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
      </div>
    );
  }

  if (loadError || !lead) {
    return (
      <div className="mx-auto max-w-5xl rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-red-600">
        {loadError || "Lead no encontrado."}
        <button onClick={() => navigate("/leads")} className="ml-4 underline">Volver</button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div className="flex items-start justify-between">
        <div>
          <button
            onClick={() => navigate("/leads")}
            className="mb-4 inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            <svg className="mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver a Leads
          </button>
          <h1 className="text-3xl font-bold text-slate-900">{lead.full_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-100">
              {INTENT_LABEL[lead.intent]}
            </span>
            <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-slate-600 border border-slate-200">
              {STATUS_LABEL[lead.status]}
            </span>
            <span className="text-slate-400">·</span>
            <span>Origen: {SOURCE_LABEL[lead.source]}</span>
            <span className="text-slate-400">·</span>
            <span>Creado {new Date(lead.created_at).toLocaleDateString()}</span>
          </div>
        </div>

        {!editing && (
          <button
            type="button"
            onClick={startEdit}
            className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300"
          >
            Editar
          </button>
        )}
      </div>

      {!editing && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <LeadScoreCard leadId={lead.id} />
          <MatchmakingPanel leadId={lead.id} />
        </div>
      )}

      {!editing && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Section title="📋 Preferencias declaradas">
              <DefList>
                <DefItem label="Intención" value={INTENT_LABEL[lead.intent]} />
                <DefItem
                  label="Presupuesto USD"
                  value={formatBudget(lead.budget_min_usd, lead.budget_max_usd)}
                />
                <DefItem label="Dormitorios mín." value={lead.bedrooms_min?.toString() ?? "—"} />
                <DefItem
                  label="Superficie mín."
                  value={lead.area_min_m2 != null ? `${lead.area_min_m2} m²` : "—"}
                />
              </DefList>
              <TagSection label="Zonas de interés" items={lead.zonas} cls="border-blue-100 bg-blue-50 text-blue-700" />
              <TagSection label="Must-haves" items={lead.must_haves} cls="border-purple-100 bg-purple-50 text-purple-700" />
            </Section>

            {lead.notes && (
              <Section title="📝 Notas">
                <p className="whitespace-pre-wrap text-sm text-slate-700">{lead.notes}</p>
              </Section>
            )}
          </div>

          <div className="space-y-6">
            <Section title="📞 Contacto">
              <DefList>
                <DefItem label="Teléfono" value={lead.phone ?? "—"} />
                <DefItem label="Email" value={lead.email ?? "—"} />
                <DefItem
                  label="Agente"
                  value={
                    lead.agent_id != null ? (
                      <Link
                        to={`/agents/${lead.agent_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {agent ? displayName(agent) : `#${lead.agent_id}`}
                      </Link>
                    ) : (
                      "Sin asignar"
                    )
                  }
                />
              </DefList>
            </Section>

            <Section title="🏠 Visitas">
              {showings.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Aún sin visitas registradas. Inicia una desde la página de la propiedad.
                </p>
              ) : (
                <ul className="space-y-3">
                  {showings.slice(0, 6).map((s) => {
                    const prop = propertiesById.get(s.property_id);
                    const durationMin =
                      s.ended_at != null
                        ? Math.max(
                            0,
                            (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) /
                              60000,
                          )
                        : null;
                    return (
                      <li key={s.id} className="border-l-2 border-blue-200 pl-3">
                        <Link
                          to={`/properties/${s.property_id}`}
                          className="font-medium text-slate-900 hover:text-blue-600 text-sm"
                        >
                          {prop?.title ?? `Propiedad #${s.property_id}`}
                        </Link>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {new Date(s.started_at).toLocaleString()}
                          {durationMin != null && ` · ${durationMin.toFixed(0)} min`}
                          {s.ended_at == null && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 border border-emerald-100">
                              En curso
                            </span>
                          )}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

          </div>
        </div>
      )}

      {editing && form && (
        <form onSubmit={handleSave} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          {saveError && (
            <div className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-600">
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Field label="Nombre completo">
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Teléfono">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputCls}
                inputMode="tel"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Origen">
              <select
                value={form.source}
                onChange={(e) => setForm({ ...form, source: e.target.value as LeadSource })}
                className={inputCls}
              >
                {LEAD_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {SOURCE_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Estado">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as LeadStatus })}
                className={inputCls}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Agente">
              <select
                value={form.agent_id}
                onChange={(e) => setForm({ ...form, agent_id: e.target.value })}
                className={inputCls}
              >
                <option value="">Sin asignar</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {displayName(u)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Intención">
              <select
                value={form.intent}
                onChange={(e) => setForm({ ...form, intent: e.target.value as LeadIntent })}
                className={inputCls}
              >
                {LEAD_INTENTS.map((i) => (
                  <option key={i} value={i}>
                    {INTENT_LABEL[i]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Presupuesto mín. USD">
              <input
                type="number"
                min="0"
                step="100"
                value={form.budget_min}
                onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Presupuesto máx. USD">
              <input
                type="number"
                min="0"
                step="100"
                value={form.budget_max}
                onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Dormitorios mín.">
              <input
                type="number"
                min="0"
                value={form.bedrooms_min}
                onChange={(e) => setForm({ ...form, bedrooms_min: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Superficie mín. m²">
              <input
                type="number"
                min="0"
                value={form.area_min_m2}
                onChange={(e) => setForm({ ...form, area_min_m2: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>

          <Field label="Zonas de interés (separadas por comas)">
            <input
              value={form.zonas}
              onChange={(e) => setForm({ ...form, zonas: e.target.value })}
              className={inputCls}
              placeholder="Achumani, Calacoto, Sopocachi"
            />
          </Field>

          <Field label="Must-haves (separadas por comas)">
            <input
              value={form.must_haves}
              onChange={(e) => setForm({ ...form, must_haves: e.target.value })}
              className={inputCls}
              placeholder="garaje, gas natural, papeles saneados"
            />
          </Field>

          <Field label="Notas">
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className={inputCls}
            />
          </Field>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function formatBudget(min: string | null, max: string | null): string {
  const f = (v: string) => `$${Number(v).toLocaleString()}`;
  if (min && max) return `${f(min)} – ${f(max)}`;
  if (max) return `≤ ${f(max)}`;
  if (min) return `≥ ${f(min)}`;
  return "—";
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function DefList({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">{children}</div>;
}

function DefItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-slate-500 text-xs uppercase tracking-wider">{label}</p>
      <p className="font-medium text-slate-900">{value}</p>
    </div>
  );
}

function TagSection({ label, items, cls }: { label: string; items: string[]; cls: string }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((t) => (
          <span
            key={t}
            className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${cls}`}
          >
            {t}
          </span>
        ))}
      </div>
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
