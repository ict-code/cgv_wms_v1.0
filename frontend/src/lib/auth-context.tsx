"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiClient } from "./api-client";
import { tokenStorage } from "./token-storage";
import { decodeJwt, isTokenExpired, type JwtPayload } from "./jwt";

interface AuthContextValue {
  user: JwtPayload | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<JwtPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // One-time hydration of auth state from localStorage after mount (a browser-only
    // external source unavailable during SSR) — not a reaction to a state/prop change.
    const token = tokenStorage.getAccessToken();
    if (token) {
      const payload = decodeJwt(token);
      if (payload && !isTokenExpired(payload)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(payload);
      } else {
        tokenStorage.clear();
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const response = await apiClient.post("/auth/login", { username, password });
    const { accessToken, refreshToken } = response.data;
    tokenStorage.setTokens(accessToken, refreshToken);
    const payload = decodeJwt(accessToken);
    setUser(payload);
  }, []);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setUser(null);
    window.location.href = "/login";
  }, []);

  return <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
