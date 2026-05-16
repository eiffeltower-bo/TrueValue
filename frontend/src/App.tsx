import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Login } from "./routes/Login";
import { Properties } from "./routes/Properties";
import { Sales } from "./routes/Sales";

export function App() {
  const location = useLocation();
  const onLogin = location.pathname === "/login";

  return (
    <div className="flex h-full flex-col">
      {!onLogin && <Nav />}
      <main className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<Navigate to="/properties" replace />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/properties"
            element={
              <ProtectedRoute>
                <Properties />
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
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
    <nav className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-slate-900">TrueValue CRM</span>
          <Link
            to="/properties"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Properties
          </Link>
          <Link to="/sales" className="text-sm text-slate-600 hover:text-slate-900">
            Sales
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          {user && <span>{user.username}</span>}
          {user && (
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-sm text-slate-700 hover:bg-slate-50"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
