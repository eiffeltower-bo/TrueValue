import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";

type LocationState = { from?: string } | null;

export function Login() {
  const { user, login, status } = useAuth();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "loading") {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
      </div>
    );
  }

  if (user) {
    const redirectTo = (location.state as LocationState)?.from ?? "/properties";
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("Invalid credentials.");
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Login failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-50 p-4 relative overflow-hidden">
      {/* Background decoration for login */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-100 via-slate-50 to-white"></div>
      
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-white/60 bg-white/80 p-8 shadow-xl shadow-blue-900/5 backdrop-blur-xl sm:p-10"
      >
        <div className="mb-8 text-center">
          <h1 className="mb-2 bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
            TrueValue CRM
          </h1>
          <p className="text-sm text-slate-500">Sign in to manage properties and sales.</p>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Username</span>
            <input
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="e.g. agent_smith"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white/50 px-4 py-2.5 text-sm transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              placeholder="••••••••"
            />
          </label>
        </div>

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50/80 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-8 w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-indigo-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
