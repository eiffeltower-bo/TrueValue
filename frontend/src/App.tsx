import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { AgentDetails } from "./routes/AgentDetails";
import { Agents } from "./routes/Agents";
import { Dashboard } from "./routes/Dashboard";
import { LeadDetails } from "./routes/LeadDetails";
import { Leads } from "./routes/Leads";
import { Login } from "./routes/Login";
import { Properties } from "./routes/Properties";
import { PropertyDetails } from "./routes/PropertyDetails";
import { Sales } from "./routes/Sales";

export function App() {
  const location = useLocation();
  const onLogin = location.pathname === "/login";

  return (
    <div className="flex h-full flex-col relative bg-slate-50">
      {/* Background decoration */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50 via-white to-white"></div>
      
      {!onLogin && <Nav />}
      
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-5xl px-6 py-8">
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Navigate to="/" replace />} />
            <Route
              path="/properties"
              element={
                <ProtectedRoute>
                  <Properties />
                </ProtectedRoute>
              }
            />
            <Route
              path="/properties/:id"
              element={
                <ProtectedRoute>
                  <PropertyDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/sales"
              element={
                <ProtectedRoute>
                  <Sales />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leads"
              element={
                <ProtectedRoute>
                  <Leads />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leads/:id"
              element={
                <ProtectedRoute>
                  <LeadDetails />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agents"
              element={
                <ProtectedRoute>
                  <Agents />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agents/:id"
              element={
                <ProtectedRoute>
                  <AgentDetails />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <nav className="sticky top-0 z-50 glass">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-8">
          <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-xl font-bold tracking-tight text-transparent">
            TrueValue CRM
          </span>
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              Inicio
            </Link>
            <Link
              to="/properties"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              Propiedades
            </Link>
            <Link
              to="/sales"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              Ventas
            </Link>
            <Link
              to="/leads"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              Leads
            </Link>
            <Link
              to="/agents"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-blue-600"
            >
              Agentes
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-5 text-sm font-medium text-slate-600">
          {user && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span className="hidden sm:inline-block">{user.username}</span>
            </div>
          )}
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-lg border border-slate-200 bg-white/50 px-4 py-2 text-sm text-slate-700 transition-all hover:bg-slate-50 hover:shadow-sm focus:ring-2 focus:ring-slate-200 focus:outline-none"
            >
              Cerrar sesión
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
