import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody, AuthUserDto, LoginResponseDto } from '@south/shared';

/**
 * לקוח ה-API.
 *
 * NoCyberHere: AUTHENTICATION
 * Threat: גניבת Access Token דרך XSS מתוך localStorage
 * Reason: ה-Access Token נשמר בזיכרון בלבד. ה-Refresh Token נמצא ב-cookie מסוג
 *         HttpOnly שה-JavaScript אינו יכול לקרוא, ומתחדש אוטומטית.
 */

const baseURL = (import.meta.env.VITE_API_BASE_URL as string) ?? 'http://localhost:3000/api/v1';

let accessToken: string | null = null;
let onUnauthenticated: (() => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setUnauthenticatedHandler(handler: (() => void) | null): void {
  onUnauthenticated = handler;
}

export const api: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

/**
 * תגובת הרענון כוללת גם את פרטי המשתמש, ולכן אין צורך בקריאה נוספת ל-/auth/me
 * בעליית האפליקציה - זה חוסך סיבוב רשת שלם לפני שהמסך הראשון מצויר.
 */
export interface RefreshResult {
  accessToken: string;
  user: AuthUserDto;
}

let refreshPromise: Promise<RefreshResult | null> | null = null;

async function refreshAccessToken(): Promise<RefreshResult | null> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<LoginResponseDto>(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
      .then((response) => {
        accessToken = response.data.accessToken;
        return { accessToken: response.data.accessToken, user: response.data.user };
      })
      .catch(() => {
        accessToken = null;
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const status = error.response?.status;
    const isAuthRoute = original?.url?.includes('/auth/');

    if (status === 401 && original && !original._retried && !isAuthRoute) {
      original._retried = true;
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        original.headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
        return api.request(original);
      }
      onUnauthenticated?.();
    }

    return Promise.reject(error);
  },
);

export { refreshAccessToken };
