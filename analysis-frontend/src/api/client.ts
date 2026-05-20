import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuth } from "@/auth/auth-store";
import type { AuthTokens } from "./types";

const baseURL = import.meta.env.VITE_API_URL ?? "/api";

export const api = axios.create({ baseURL });

// ── Request: подставить access-токен ─────────────────────────────────────
api.interceptors.request.use((config) => {
  const token = useAuth.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response: 401 → попытка refresh, иначе logout ────────────────────────
let refreshing: Promise<AuthTokens> | null = null;

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

async function refreshAccessToken(): Promise<AuthTokens> {
  if (refreshing) return refreshing;
  const refreshToken = useAuth.getState().refreshToken;
  if (!refreshToken) throw new Error("no refresh token");

  refreshing = axios
    .post<AuthTokens>(`${baseURL}/auth/refresh`, { refreshToken })
    .then((res) => {
      useAuth.getState().setTokens(res.data);
      return res.data;
    })
    .finally(() => {
      refreshing = null;
    });

  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (err: AxiosError) => {
    const original = err.config as RetriableConfig | undefined;
    if (
      err.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/")
    ) {
      original._retry = true;
      try {
        const tokens = await refreshAccessToken();
        original.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(original);
      } catch {
        useAuth.getState().clear();
      }
    }
    return Promise.reject(err);
  },
);
