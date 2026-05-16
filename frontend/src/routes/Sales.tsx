import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
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
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Sales</h1>
        <button
          type="button"
          onClick={() => setFormOpen((v) => !v)}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          {formOpen ? "Close form" : "Register sale"}
        </button>
      </div>

      {formOpen && user && (
        <SaleForm
          agentId={user.user_id}
          onCreated={(created) => {
            setItems((prev) => [...prev, created]);
            setFormOpen(false);
          }}
        />
      )}

      {loadError && (
        <div className="my-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </div>
      )}

      <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-2 font-medium">ID</th>
              <th className="px-4 py-2 font-medium">Product / Service</th>
              <th className="px-4 py-2 font-medium">Payment</th>
              <th className="px-4 py-2 font-medium">Location</th>
              <th className="px-4 py-2 font-medium text-right">Amount</th>
              <th className="px-4 py-2 font-medium">Agent</th>
              <th className="px-4 py-2 font-medium">Sold at</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-500">
                  No sales yet. Click "Register sale" to add one.
                </td>
              </tr>
            )}
            {!loading &&
              items.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 text-slate-500">{s.id}</td>
                  <td className="px-4 py-2 font-medium text-slate-900">{s.product_or_service}</td>
                  <td className="px-4 py-2 capitalize">{s.payment_method}</td>
                  <td className="px-4 py-2">{s.location}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{s.amount}</td>
                  <td className="px-4 py-2 text-slate-500">#{s.agent_id}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {new Date(s.sold_at).toLocaleString()}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
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
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      });
      onCreated(created);
      setProductOrService("");
      setAmount("");
      setPaymentMethod("cash");
      setLocation("");
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
    <form
      onSubmit={handleSubmit}
      className="grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2"
    >
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Product / Service</span>
        <input
          required
          value={productOrService}
          onChange={(e) => setProductOrService(e.target.value)}
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Amount</span>
        <input
          required
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={inputCls}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Payment method</span>
        <select
          value={paymentMethod}
          onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
          className={inputCls}
        >
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-700">Location</span>
        <input
          required
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className={inputCls}
        />
      </label>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">
          {error}
        </div>
      )}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          {submitting ? "Saving…" : "Register sale"}
        </button>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none";
