import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as authApi from "../api/auth";
import type { CurrentUser } from "../api/auth";

type AuthState = {
  user: CurrentUser | null;
  status: "loading" | "ready";
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;
    authApi
      .tryGetCurrentUser()
      .then((current) => {
        if (!cancelled) {
          setUser(current);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setStatus("ready");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value: AuthState = {
    user,
    status,
    async login(username, password) {
      const current = await authApi.login(username, password);
      setUser(current);
    },
    async logout() {
      await authApi.logout().catch(() => {
        // Best-effort logout — we clear local state regardless.
      });
      setUser(null);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
