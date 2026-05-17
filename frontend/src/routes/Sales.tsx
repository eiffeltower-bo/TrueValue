import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import { listProperties, type Property } from "../api/properties";
import {
  PAYMENT_METHODS,
  createSale,
  listSales,
  type PaymentMethod,
  type Sale,
} from "../api/sales";
import { displayName, listUsers, type User } from "../api/users";
import { SortableHeader, useSort, useSorted } from "./tableUtils";

function paymentBadgeCls(method: string): string {
  const m = method.toLowerCase();
  if (m === "efectivo") return "bg-emerald-50 text-emerald-700 border-emerald-100";
  if (m.startsWith("tarjeta")) return "bg-purple-50 text-purple-700 border-purple-100";
  if (m.startsWith("qr")) return "bg-blue-50 text-blue-700 border-blue-100";
  if (m === "transferencia bancaria") return "bg-indigo-50 text-indigo-700 border-indigo-100";
  if (m === "cheque") return "bg-amber-50 text-amber-700 border-amber-100";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

type SaleSortKey =
  | "id"
  | "product_or_service"
  | "payment_method"
  | "location"
  | "amount"
  | "agent"
  | "property"
  | "sold_at";

export function Sales() {
  const { user } = useAuth();
  const [items, setItems] = useState<Sale[]>([]);
  const [agents, setAgents] = useState<Map<number, User>>(new Map());
  const [propertyMap, setPropertyMap] = useState<Map<number, Property>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  // Filter options come from the live data so they always match whatever the
  // DB actually contains (seed data uses Spanish payment labels).
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const { sort, toggle } = useSort<SaleSortKey>({ key: "sold_at", dir: "desc" });

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      const [sales, users, props] = await Promise.all([
        listSales(),
        listUsers().catch(() => [] as User[]),
        listProperties().catch(() => [] as Property[]),
      ]);
      setItems(sales);
      setAgents(new Map(users.map((u) => [u.id, u])));
      setPropertyMap(new Map(props.map((p) => [p.id, p])));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Error al cargar ventas.");
    } finally {
      setLoading(false);
    }
  }

  const paymentOptions = useMemo(
    () => Array.from(new Set(items.map((s) => s.payment_method))).sort(),
    [items],
  );

  const agentLabel = (agentId: number) => {
    const a = agents.get(agentId);
    return a ? displayName(a) : `#${agentId}`;
  };

  const propertyLabel = (propertyId: number | null) => {
    if (propertyId == null) return "";
    const p = propertyMap.get(propertyId);
    return p ? p.title : `#${propertyId}`;
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((s) => {
      if (paymentFilter !== "all" && s.payment_method !== paymentFilter) return false;
      if (!q) return true;
      const haystack = [
        s.product_or_service,
        s.location,
        s.payment_method,
        agentLabel(s.agent_id),
        propertyLabel(s.property_id),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search, paymentFilter, agents, propertyMap]);

  const sorted = useSorted(filtered, sort, (s, key) => {
    switch (key) {
      case "id": return s.id;
      case "product_or_service": return s.product_or_service;
      case "payment_method": return s.payment_method;
      case "location": return s.location;
      case "amount": return Number(s.amount);
      case "agent": return agentLabel(s.agent_id);
      case "property": return propertyLabel(s.property_id);
      case "sold_at": return s.sold_at;
    }
  });

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ventas</h1>
          <p className="text-sm text-slate-500 mt-1">Seguimiento de tus transacciones recientes</p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className={`inline-flex items-center rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-md transition-all focus:outline-none focus:ring-2 ${
            formOpen
              ? "bg-slate-600 hover:bg-slate-700 focus:ring-slate-500/50"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg focus:ring-blue-500/50"
          }`}
        >
          {formOpen ? (
            <>
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cerrar formulario
            </>
          ) : (
            <>
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Registrar venta
            </>
          )}
        </button>
      </div>

      {formOpen && user && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-xl shadow-blue-900/5 transition-all">
          <div className="border-b border-slate-100 bg-blue-50/50 px-6 py-4">
            <h2 className="text-sm font-semibold text-blue-900">Detalles de la nueva transacción</h2>
          </div>
          <div className="p-6">
            <SaleForm
              agentId={user.user_id}
              onCreated={(created) => {
                setItems((prev) => [...prev, created]);
                setFormOpen(false);
              }}
            />
          </div>
        </div>
      )}

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
            placeholder="Buscar por producto, ubicación, agente, propiedad…"
            className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        >
          <option value="all">Todos los pagos</option>
          {paymentOptions.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span className="text-xs text-slate-500">{sorted.length} de {items.length}</span>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500">
              <tr>
                <SortableHeader<SaleSortKey> label="ID" sortKey="id" sort={sort} onToggle={toggle} />
                <SortableHeader<SaleSortKey> label="Producto / Servicio" sortKey="product_or_service" sort={sort} onToggle={toggle} />
                <SortableHeader<SaleSortKey> label="Pago" sortKey="payment_method" sort={sort} onToggle={toggle} />
                <SortableHeader<SaleSortKey> label="Ubicación" sortKey="location" sort={sort} onToggle={toggle} />
                <SortableHeader<SaleSortKey> label="Monto" sortKey="amount" sort={sort} onToggle={toggle} align="right" />
                <SortableHeader<SaleSortKey> label="Agente" sortKey="agent" sort={sort} onToggle={toggle} />
                <SortableHeader<SaleSortKey> label="Propiedad" sortKey="property" sort={sort} onToggle={toggle} />
                <SortableHeader<SaleSortKey> label="Fecha" sortKey="sold_at" sort={sort} onToggle={toggle} />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"></div>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <svg className="mb-3 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Aún no hay ventas. Pulsa "Registrar venta" para agregar una.
                    </div>
                  </td>
                </tr>
              )}
              {!loading && items.length > 0 && sorted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-sm text-slate-500">
                    Ninguna venta coincide con los filtros.
                  </td>
                </tr>
              )}
              {!loading &&
                sorted.map((s) => {
                  const agent = agents.get(s.agent_id);
                  const linkedProp = s.property_id != null ? propertyMap.get(s.property_id) : undefined;
                  return (
                    <tr key={s.id} className="transition-colors hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4 text-slate-500">#{s.id}</td>
                      <td className="px-6 py-4 font-medium text-slate-900">{s.product_or_service}</td>
                      <td className="whitespace-nowrap px-6 py-4">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${paymentBadgeCls(s.payment_method)}`}>
                          {s.payment_method}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{s.location}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-emerald-600 tabular-nums">
                        ${Number(s.amount).toLocaleString()}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                        <Link
                          to={`/agents/${s.agent_id}`}
                          className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-blue-50/60"
                        >
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-medium text-white">
                            {(agent ? displayName(agent) : String(s.agent_id)).charAt(0).toUpperCase()}
                          </div>
                          <span className="text-sm text-blue-700 hover:underline">
                            {agent ? displayName(agent) : `#${s.agent_id}`}
                          </span>
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {s.property_id != null ? (
                          <Link
                            to={`/properties/${s.property_id}`}
                            className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            <span className="max-w-[14rem] truncate">{linkedProp ? linkedProp.title : `#${s.property_id}`}</span>
                          </Link>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-slate-500 text-xs">
                        {new Date(s.sold_at).toLocaleString()}
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

function SaleForm({
  agentId,
  onCreated,
}: {
  agentId: number;
  onCreated: (s: Sale) => void;
}) {
  const [productOrService, setProductOrService] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Efectivo");
  const [location, setLocation] = useState("");
  const [propertyId, setPropertyId] = useState<number | "">("");
  const [properties, setProperties] = useState<Property[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listProperties()
      .then((rows) => {
        if (!cancelled) setProperties(rows);
      })
      .catch(() => {
        // Property list is optional context for the picker — failing to load
        // is non-fatal; user can still submit without a linked property.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await createSale({
        product_or_service: productOrService.trim(),
        amount: Number(amount),
        payment_method: paymentMethod,
        location: location.trim(),
        agent_id: agentId,
        property_id: propertyId === "" ? null : propertyId,
      });
      onCreated(created);
      setProductOrService("");
      setAmount("");
      setPaymentMethod("Efectivo");
      setLocation("");
      setPropertyId("");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.status}: ${err.message}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("No se pudo registrar la venta.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Producto / Servicio</span>
        <input
          required
          value={productOrService}
          onChange={(e) => setProductOrService(e.target.value)}
          className={inputCls}
          placeholder="p. ej. Comisión venta departamento"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Monto</span>
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <span className="text-slate-500 sm:text-sm">$</span>
          </div>
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={`${inputCls} pl-7`}
            placeholder="0.00"
          />
        </div>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Método de pago</span>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          className={inputCls}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Ubicación</span>
        <input
          required
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={inputCls}
          placeholder="p. ej. Achumani, La Paz"
        />
      </label>

      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          Propiedad vinculada <span className="font-normal text-slate-400">(opcional)</span>
        </span>
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value === "" ? "" : Number(e.target.value))}
          className={inputCls}
        >
          <option value="">— Sin propiedad —</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              #{p.id} — {p.title} — ${Number(p.price).toLocaleString()}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-600 sm:col-span-2">
          {error}
        </div>
      )}

      <div className="sm:col-span-2 flex justify-end">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          {submitting ? "Procesando…" : "Registrar transacción"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
