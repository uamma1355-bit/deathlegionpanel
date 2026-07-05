/**
 * Auth context — uses a HYBRID auth flow to avoid cross-site cookie issues.
 *
 * Flow:
 *   1. Login with cookies (CSRF cookie → POST /auth/login) — this works
 *      because the login response includes the user object.
 *   2. IMMEDIATELY create a client API key via /account/api-keys (still
 *      using the just-set session cookie).
 *   3. Store the API key in localStorage.
 *   4. All subsequent requests use Authorization: Bearer <ptlc_...>.
 *   5. On logout, delete the API key + clear localStorage.
 *
 * This avoids the third-party cookie blocking that breaks Sanctum's
 * cookie-only auth when the frontend (Vercel) and backend (Daytona)
 * are on different root domains.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { getAccount } from '@/api/account/getAccount';
import {
  login as apiLogin,
  loginCheckpoint as apiLoginCheckpoint,
  logout as apiLogout,
  createApiKey,
  deleteApiKey,
  type LoginRequest,
  type LoginCheckpointRequest,
  type LoginUser,
} from '@/api/auth';
import { getStoredToken, setStoredToken } from '@/config/env';
import type { UserAttributes } from '@shared/types/user';
import type { TwoFactorRequiredError } from '@/api/http';

const API_KEY_STORAGE_KEY = 'pterodactyl.api_token';
const API_KEY_IDENTIFIER_STORAGE_KEY = 'pterodactyl.api_key_identifier';

export interface AuthContextValue {
  user: UserAttributes | null;
  loading: boolean;
  error: string | null;
  login: (req: LoginRequest) => Promise<void>;
  loginCheckpoint: (req: LoginCheckpointRequest) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loginUserToAttributes(u: LoginUser): UserAttributes {
  return {
    id: 0,
    admin: u.root_admin,
    username: u.username,
    email: u.email,
    first_name: u.name_first,
    last_name: u.name_last,
    language: u.language,
  };
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<UserAttributes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await getAccount();
      setUser(resp.attributes);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        setUser(null);
        // Clear any stale token
        setStoredToken(null);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load account');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // On mount: if we have a stored token, refresh user info
    if (getStoredToken()) {
      void refresh();
    } else {
      setLoading(false);
    }
  }, [refresh]);

  const login = useCallback(
    async (req: LoginRequest): Promise<void> => {
      setError(null);
      try {
        // Step 1: Login with cookies (CSRF + session)
        const resp = await apiLogin(req);
        if (!resp.complete) {
          // 2FA challenge — re-throw for the page to handle
          if (resp.confirmation_token) {
            const twoFactorErr: TwoFactorRequiredError = {
              type: 'two-factor-required',
              confirmationToken: resp.confirmation_token,
              status: 400,
            };
            throw twoFactorErr;
          }
          throw new Error('Login did not complete');
        }

        // Step 2: Use the user object from the login response immediately
        if (resp.user) {
          setUser(loginUserToAttributes(resp.user));
        }

        // Step 3: Create an API key for token-based auth (avoids cross-site cookie issues)
        try {
          const apiKey = await createApiKey('browser-session');
          setStoredToken(apiKey);
          // Store the identifier (first 16 chars, e.g. "ptlc_AhV8dFZtWXN") for deletion at logout
          if (typeof window !== 'undefined' && apiKey.startsWith('ptlc_')) {
            window.localStorage.setItem(API_KEY_IDENTIFIER_STORAGE_KEY, apiKey.substring(0, 16));
          }
          // Refresh to get the canonical user shape (with id)
          void refresh();
        } catch (err) {
          // If API key creation fails, fall back to cookie mode
          console.warn('API key creation failed, using cookie mode', err);
          void refresh();
        }
      } catch (err) {
        if ((err as { type?: string }).type === 'two-factor-required') {
          throw err as TwoFactorRequiredError;
        }
        setError(extractErrorMessage(err));
        throw err;
      }
    },
    [refresh],
  );

  const loginCheckpoint = useCallback(
    async (req: LoginCheckpointRequest): Promise<void> => {
      setError(null);
      try {
        const resp = await apiLoginCheckpoint(req);
        if (resp.user) {
          setUser(loginUserToAttributes(resp.user));
        }
        // Create API key after 2FA too
        try {
          const apiKey = await createApiKey('browser-session');
          setStoredToken(apiKey);
          if (typeof window !== 'undefined' && apiKey.startsWith('ptlc_')) {
            window.localStorage.setItem(API_KEY_IDENTIFIER_STORAGE_KEY, apiKey.substring(0, 16));
          }
        } catch {
          // Fall back to cookie mode
        }
        void refresh();
      } catch (err) {
        setError(extractErrorMessage(err));
        throw err;
      }
    },
    [refresh],
  );

  const logout = useCallback(async (): Promise<void> => {
    // Try to delete the API key first
    if (typeof window !== 'undefined') {
      const identifier = window.localStorage.getItem(API_KEY_IDENTIFIER_STORAGE_KEY);
      if (identifier) {
        try {
          await deleteApiKey(identifier);
        } catch {
          // Ignore — the key might already be gone
        }
        window.localStorage.removeItem(API_KEY_IDENTIFIER_STORAGE_KEY);
      }
    }
    try {
      await apiLogout();
    } catch {
      // Even if logout fails, clear local state.
    }
    setStoredToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, error, login, loginCheckpoint, logout, refresh }),
    [user, loading, error, login, loginCheckpoint, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

function extractErrorMessage(err: unknown): string {
  if (typeof err === 'object' && err !== null && 'errors' in err) {
    const errors = (err as { errors: { detail?: string; code?: string }[] }).errors;
    if (Array.isArray(errors) && errors.length > 0) {
      return errors[0]?.detail ?? errors[0]?.code ?? 'Unknown error';
    }
  }
  if (err instanceof Error) return err.message;
  return 'Unknown error';
}

// Export storage key for the http interceptor to read
export { API_KEY_STORAGE_KEY };
