import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import {
  PROPERTY_TYPES,
  createProperty,
  listProperties,
  type Property,
  type PropertyType,
} from "../api/properties";

export function Properties() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setLoadError(null);
    try {
      setItems(await listProperties());
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load properties.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Properties</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your real estate listings</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Property
        </button>
      </div>

      {/* Dynamic Pricing Alerts Panel */}
      <div className="mb-8 overflow-hidden rounded-2xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-6 shadow-sm relative">
        <div className="absolute right-0 top-0 p-6 opacity-10">
          <svg className="h-24 w-24 text-orange-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <div className="flex items-start justify-between relative z-10">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-orange-900 flex items-center gap-2">
                High Demand Detected
                <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Action Required</span>
              </h2>
              <p className="mt-1 text-sm text-orange-800 max-w-2xl">
                Edge sensors detected a <strong>42% spike in foot traffic</strong> over the last 48 hours for multiple commercial listings. AI recommends a dynamic price increase of 15% to maximize yield.
              </p>
            </div>
          </div>
          <button 
            className="flex-shrink-0 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-orange-700 hover:shadow focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            onClick={() => alert("Simulated: Applying 15% price increase to high-traffic properties...")}
          >
            Apply +15% Price Increase
          </button>
        </div>
      </div>

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
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4 text-right">Price</th>
                <th className="px-6 py-4">Agent</th>
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
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      No properties yet. Click "New Property" to add one.
                    </div>
                  </td>
                </tr>
              )}
              {!loading &&
                items.map((p) => (
                  <tr 
                    key={p.id} 
                    onClick={() => navigate(`/properties/${p.id}`)}
                    className="transition-colors hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="whitespace-nowrap px-6 py-4 text-slate-500">#{p.id}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{p.title}</td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 capitalize border border-blue-100">
                        {p.property_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{p.location}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-right font-medium text-slate-900 tabular-nums">
                      ${p.price.toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-slate-500">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">
                          {p.agent_id}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && user && (
        <NewPropertyModal
          agentId={user.user_id}
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

type NewPropertyModalProps = {
  agentId: number;
  onClose: () => void;
  onCreated: (p: Property) => void;
};

function NewPropertyModal({ agentId, onClose, onCreated }: NewPropertyModalProps) {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [propertyType, setPropertyType] = useState<PropertyType>("apartment");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await createProperty({
        title: title.trim(),
        price: Number(price),
        property_type: propertyType,
        location: location.trim(),
        agent_id: agentId,
      });
      onCreated(created);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(`${err.status}: ${err.message}`);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to create property.");
      }
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
          <h2 className="text-lg font-semibold text-slate-900">New Property Listing</h2>
        </div>

        <div className="p-6 space-y-5">
          <Field label="Title">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputCls}
              placeholder="e.g. Modern Downtown Loft"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Price">
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-slate-500 sm:text-sm">$</span>
                </div>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className={`${inputCls} pl-7`}
                  placeholder="0.00"
                />
              </div>
            </Field>

            <Field label="Type">
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                className={inputCls}
              >
                {PROPERTY_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Location">
            <input
              required
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputCls}
              placeholder="e.g. 123 Tech Avenue"
            />
          </Field>

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
            {submitting ? "Saving…" : "Create Property"}
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
