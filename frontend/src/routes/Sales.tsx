import { useEffect, useState, type FormEvent } from "react";
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

export function Sales() {
  const { user } = useAuth();
  const [items, setItems] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      setItems(await listSales());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load sales.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales</h1>
          <p className="text-sm text-slate-500 mt-1">Track your recent transactions</p>
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
              Close Form
            </>
          ) : (
            <>
              <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Register Sale
            </>
          )}
        </button>
      </div>

      {formOpen && user && (
        <div className="mb-8 overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-xl shadow-blue-900/5 transition-all">
          <div className="border-b border-slate-100 bg-blue-50/50 px-6 py-4">
            <h2 className="text-sm font-semibold text-blue-900">New Transaction Details</h2>
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

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/80 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Product / Service</th>
                <th className="px-6 py-4">Payment</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4">Agent</th>
                <th className="px-6 py-4">Sold at</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center">
                    <div className="flex justify-center">
                      <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"></div>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <svg className="mb-3 h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      No sales yet. Click "Register Sale" to add one.
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((s) => (
                  <tr key={s.id} className="transition-colors hover:bg-slate-50">
                    <td className="whitespace-nowrap px-6 py-4 text-slate-500">#{s.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{s.product_or_service}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize border ${
                        s.payment_method === 'cash' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : s.payment_method === 'credit_card'
                          ? 'bg-purple-50 text-purple-700 border-purple-100'
                          : 'bg-orange-50 text-orange-700 border-orange-100'
                      }`}>
                        {s.payment_method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{s.location}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-emerald-600 tabular-nums">
                      ${s.amount.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">
                          {s.agent_id}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-slate-500 text-xs">
                      {new Date(s.sold_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
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
      setPaymentMethod("cash");
      setLocation("");
      setPropertyId("");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.status}: ${err.message}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to register sale.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Product / Service</span>
        <input
          required
          value={productOrService}
          onChange={(e) => setProductOrService(e.target.value)}
          className={inputCls}
          placeholder="e.g. Consulting Fee"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Amount</span>
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
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Payment method</span>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          className={inputCls}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Location</span>
        <input
          required
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={inputCls}
          placeholder="e.g. Branch Office"
        />
      </label>

      <label className="block sm:col-span-2">
        <span className="mb-1.5 block text-sm font-medium text-slate-700">
          Linked property <span className="font-normal text-slate-400">(optional)</span>
        </span>
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value === "" ? "" : Number(e.target.value))}
          className={inputCls}
        >
          <option value="">— No property —</option>
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
          {submitting ? "Processing…" : "Submit Transaction"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";
