import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthTokens, JwtPayload, UserRole } from "@/api/types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  email: string | null;
  role: UserRole | null;

  setTokens: (tokens: AuthTokens) => void;
  clear: () => void;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payload] = token.split(".");
    return JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as JwtPayload;
  } catch {
    return null;
  }
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      email: null,
      role: null,

      setTokens: ({ accessToken, refreshToken }) => {
        const payload = decodeJwt(accessToken);
        set({
          accessToken,
          refreshToken,
          userId: payload?.sub ?? null,
          email: payload?.email ?? null,
          role: payload?.role ?? null,
        });
      },
      clear: () =>
        set({
          accessToken: null,
          refreshToken: null,
          userId: null,
          email: null,
          role: null,
        }),
    }),
    { name: "analysis-auth" },
  ),
);

export const isStudent = (role: UserRole | null) => role === "student";
export const isTeacher = (role: UserRole | null) => role === "teacher";
