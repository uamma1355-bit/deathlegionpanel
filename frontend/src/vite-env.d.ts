/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_AUTH_MODE: 'cookie' | 'token';
  readonly VITE_APP_NAME: string;
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_RECAPTCHA_SITE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface Window {
  __ENV__?: Partial<Record<string, string>>;
}
