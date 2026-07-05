/**
 * Runtime config — read from import.meta.env (Vite build-time) with
 * fallbacks for development. All env access goes through this module
 * so we have a single source of truth.
 */

type AuthMode = 'cookie' | 'token';

interface RuntimeConfig {
  apiUrl: string;
  authMode: AuthMode;
  appName: string;
  sentryDsn: string | null;
  recaptchaSiteKey: string | null;
}

function readEnv(key: string, fallback = ''): string {
  // import.meta.env is statically replaced by Vite at build time.
  // The window.__ENV__ fallback allows runtime injection (e.g. for preview deployments).
  const fromImport = (import.meta.env[`VITE_${key}`] as string | undefined) ?? '';
  const fromWindow =
    typeof window !== 'undefined' && window.__ENV__
      ? ((window.__ENV__ as Record<string, string | undefined>)[`VITE_${key}`] ?? '')
      : '';
  return fromImport || fromWindow || fallback;
}

function parseAuthMode(value: string): AuthMode {
  return value === 'token' ? 'token' : 'cookie';
}

let cached: RuntimeConfig | null = null;

export function getConfig(): RuntimeConfig {
  if (cached) return cached;
  cached = {
    apiUrl: readEnv('API_URL', 'http://127.0.0.1:8000').replace(/\/$/, ''),
    authMode: parseAuthMode(readEnv('AUTH_MODE', 'cookie')),
    appName: readEnv('APP_NAME', 'Pterodactyl'),
    sentryDsn: readEnv('SENTRY_DSN') || null,
    recaptchaSiteKey: readEnv('RECAPTCHA_SITE_KEY') || null,
  };
  return cached;
}

/** The bearer token (token mode only) — stored in localStorage under a versioned key. */
const TOKEN_STORAGE_KEY = 'pterodactyl.api_token';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

/** Get the absolute URL for an API path. Handles both leading-slash and no-slash. */
export function apiUrl(path: string): string {
  const trimmed = path.startsWith('/') ? path : `/${path}`;
  return `${getConfig().apiUrl}${trimmed}`;
}
