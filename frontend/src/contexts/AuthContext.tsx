import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, clearTokens, getAccessToken, storeTokens } from "../lib/api";
import { decodeAccessToken } from "../lib/jwt";
import type { AuthUser, Role, TokenPair } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  loginStaff: (email: string, password: string) => Promise<void>;
  registerCustomer: (name: string, surname: string, gsm: string, email?: string) => Promise<{ otpHint?: string }>;
  verifyOtp: (gsm: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchMe(): Promise<AuthUser | null> {
  try {
    const response = await api.get("/api/v1/auth/me");
    return response.data.data as AuthUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setIsLoading(false);
      return;
    }
    fetchMe()
      .then((profile) => {
        if (profile) {
          setUser(profile);
        } else {
          const decoded = decodeAccessToken(token);
          if (decoded) setUser({ id: decoded.sub, role: decoded.role as Role, expertise: decoded.expertise, region: decoded.region });
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const applyTokens = async (tokens: TokenPair) => {
    storeTokens(tokens);
    const profile = await fetchMe();
    if (profile) {
      setUser(profile);
    } else {
      const decoded = decodeAccessToken(tokens.accessToken);
      if (decoded) setUser({ id: decoded.sub, role: decoded.role as Role, expertise: decoded.expertise, region: decoded.region });
    }
  };

  const loginStaff = async (email: string, password: string) => {
    const response = await api.post("/api/v1/auth/login", { email, password });
    await applyTokens(response.data.data as TokenPair);
  };

  const registerCustomer = async (name: string, surname: string, gsm: string, email?: string) => {
    const response = await api.post("/api/v1/auth/register", { name, surname, gsm, email });
    return response.data.data as { otpHint?: string };
  };

  const verifyOtp = async (gsm: string, code: string) => {
    const response = await api.post("/api/v1/auth/otp/verify", { gsm, code });
    await applyTokens(response.data.data as TokenPair);
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem("netopscell.refreshToken");
    try {
      if (refreshToken) await api.post("/api/v1/auth/logout", { refreshToken });
    } finally {
      clearTokens();
      setUser(null);
    }
  };

  const value = useMemo(
    () => ({ user, isLoading, loginStaff, registerCustomer, verifyOtp, logout }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth, AuthProvider icinde kullanilmalidir.");
  return ctx;
}
