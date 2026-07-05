/**
 * Axios instance + interceptors for the decoupled Pterodactyl frontend.
 *
 * - Cookie mode (default): `withCredentials: true`, no `Authorization` header.
 *   The browser sends `pterodactyl_session` automatically. Before any mutation
 *   we ensure the XSRF-TOKEN cookie is present via `ensureCsrfCookie()`.
 * - Token mode (opt-in): `Authorization: Bearer ptlc_...` attached in
 *   interceptor; no `withCredentials`.
 *
 * The 2FA challenge (`AuthenticationRequiredException` from /auth/login) is
 * normalized into a typed rejection that the Login page can handle.
 */

import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";

import {
  apiUrl,
  getStoredToken,
  setStoredToken,
} from '@/config/env';
import type { JsonApiErrorResponse } from '@shared/types/api';

const XSRF_COOKIE_NAME = 'XSRF-TOKEN';
const XSRF_HEADER = 'X-XSRF-TOKEN';

export interface TwoFactorRequiredError {
  type: 'two-factor-required';
  confirmationToken: string;
  status: number;
}

export interface NormalizedApiError {
  type: 'api-error';
  status: number;
  errors: JsonApiErrorResponse['errors'];
  raw: AxiosError;
}

export type PterodactylError = TwoFactorRequiredError | NormalizedApiError;

let csrfPromise: Promise<void> | null = null;

async function ensureCsrfCookie(): Promise<void> {
  if (typeof document === 'undefined') return;
  // If the cookie is already present, no need to re-fetch.
  const hasCookie = document.cookie.split(';').some((c) => c.trim().startsWith(`${XSRF_COOKIE_NAME}=`));
  if (hasCookie) return;
  if (csrfPromise) return csrfPromise;
  csrfPromise = axios
    .get(apiUrl('/sanctum/csrf-cookie'), { withCredentials: true })
    .then(() => undefined)
    .finally(() => {
      csrfPromise = null;
    });
  return csrfPromise;
}

function readXsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${XSRF_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1] ?? '') : null;
}

function isMutation(method: string | undefined): boolean {
  const m = (method ?? 'get').toLowerCase();
  return m !== 'get' && m !== 'head' && m !== 'options';
}

const http: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 30_000,
  // Always send credentials — needed for the initial login (CSRF cookie + session cookie)
  // before we have a bearer token. After login, we use Bearer auth and cookies are ignored.
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Request interceptor: attach Authorization header if we have a token,
// otherwise fall back to CSRF cookie for mutations.
http.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  // Absolute URL (e.g. a Wings direct upload/download) — bypass auth injection.
  if (config.url && /^https?:\/\//.test(config.url)) {
    return config;
  }

  // Rewrite relative URLs to absolute against the configured API URL.
  if (config.url && !config.url.startsWith('http')) {
    config.url = apiUrl(config.url);
  }

  // PRIORITY: If we have a stored bearer token, use it (no CSRF needed).
  // This is the case after login creates an API key.
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
    return config;
  }

  // FALLBACK: Cookie mode (used during the initial login flow before an
  // API key is created). Requires CSRF token for mutations.
  if (isMutation(config.method)) {
    await ensureCsrfCookie();
    const xsrf = readXsrfToken();
    if (xsrf) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>)[XSRF_HEADER] = xsrf;
    }
  }

  return config;
});

// Response interceptor: normalize errors into PterodactylError.
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<JsonApiErrorResponse>) => {
    if (!error.response) {
      // Network error — rethrow as-is, the consumer will handle.
      return Promise.reject<NormalizedApiError>({
        type: 'api-error',
        status: 0,
        errors: [{ code: 'NetworkError', detail: error.message || 'Network error' }],
        raw: error,
      });
    }

    const { status, data } = error.response;
    const firstError = data?.errors?.[0];

    // 2FA challenge from /auth/login — surface the confirmation token.
    if (status === 400 && firstError?.code === 'AuthenticationRequiredException') {
      const token = (firstError.meta?.confirmation_token as string | undefined) ?? '';
      const rejection: TwoFactorRequiredError = {
        type: 'two-factor-required',
        confirmationToken: token,
        status,
      };
      return Promise.reject(rejection);
    }

    // 401 — clear any stored token (the user needs to re-login)
    if (status === 401) {
      setStoredToken(null);
    }

    const rejection: NormalizedApiError = {
      type: 'api-error',
      status,
      errors: data?.errors ?? [{ code: 'UnknownError', status: String(status), detail: error.message }],
      raw: error,
    };
    return Promise.reject(rejection);
  },
);

export type { AxiosRequestConfig };
export { http };
