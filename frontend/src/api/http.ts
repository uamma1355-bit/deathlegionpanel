/**
 * Axios instance + interceptors for the decoupled Pterodactyl frontend.
 *
 * Auth flow:
 *   1. Login POST → sets session cookie (CSRF disabled for auth routes)
 *   2. Immediately create API key (using session cookie) → returns ptlc_... token
 *   3. All subsequent requests use Authorization: Bearer ptlc_... (no cookies needed)
 *
 * The CSRF cookie logic is REMOVED entirely because:
 *   - CSRF is disabled in the backend for /api/client/auth/* and /api/client/account/api-keys
 *   - All other mutations use bearer token auth (which doesn't need CSRF)
 *   - The /sanctum/csrf-cookie call was creating a NEW session that overwrote
 *     the authenticated login session, breaking API key creation
 */

import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";

import { apiUrl, getStoredToken, setStoredToken } from '@/config/env';
import type { JsonApiErrorResponse } from '@shared/types/api';

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

const http: AxiosInstance = axios.create({
  baseURL: '',
  timeout: 30_000,
  // Send credentials for the initial login (needs session cookie).
  // After login, we switch to Bearer auth and cookies are ignored.
  withCredentials: true,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
});

// Request interceptor: attach Authorization header if we have a token.
// No CSRF logic — CSRF is disabled in the backend for cookie-based routes,
// and token-based routes don't need CSRF.
http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Absolute URL (e.g. a Wings direct upload/download) — bypass auth injection.
  if (config.url && /^https?:\/\//.test(config.url)) {
    return config;
  }

  // Rewrite relative URLs to absolute against the configured API URL.
  // In production (Vercel), apiUrl() returns the relative path (same-origin via proxy).
  if (config.url && !config.url.startsWith('http')) {
    config.url = apiUrl(config.url);
  }

  // If we have a stored bearer token, use it (no CSRF needed).
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>).Authorization = `Bearer ${token}`;
  }

  // For the initial login flow (no token yet), the session cookie is sent
  // automatically by the browser (withCredentials: true). No CSRF needed
  // because we disabled it in VerifyCsrfToken::$except for auth routes.

  return config;
});

// Response interceptor: normalize errors into PterodactylError.
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<JsonApiErrorResponse>) => {
    if (!error.response) {
      // Network error
      return Promise.reject<NormalizedApiError>({
        type: 'api-error',
        status: 0,
        errors: [{ code: 'NetworkError', detail: error.message || 'Network error' }],
        raw: error,
      });
    }

    const { status, data } = error.response;
    const firstError = data?.errors?.[0];

    // 2FA challenge from /auth/login
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
