/**
 * Auth API surface. Mirrors docs/06-APIContract.md §3.
 *
 * Upstream `Auth\LoginController` returns `{ data: { complete, confirmation_token?, intended?, user? } }`
 * where `user` is the full user object (uuid, username, email, root_admin, etc.).
 */

import { http } from '@/api/http';

export interface LoginRequest {
  /** Username OR email — the upstream controller accepts either via the `user` field. */
  user: string;
  password: string;
  recaptcha?: string;
}

/** User object as returned in the login response (richer than /account). */
export interface LoginUser {
  uuid: string;
  username: string;
  email: string;
  name_first: string;
  name_last: string;
  language: string;
  root_admin: boolean;
  use_totp: boolean;
  gravatar: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoginResponse {
  complete: boolean;
  confirmation_token?: string;
  intended?: string;
  user?: LoginUser;
}

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const res = await http.post<unknown>('/api/client/auth/login', payload);
  return normalizeLoginResponse(res.data);
}

export interface LoginCheckpointRequest {
  confirmation_token: string;
  code: string;
  recovery_token?: string;
}

export async function loginCheckpoint(payload: LoginCheckpointRequest): Promise<LoginResponse> {
  const res = await http.post<unknown>('/api/client/auth/login-checkpoint', payload);
  return normalizeLoginResponse(res.data);
}

export async function logout(): Promise<void> {
  await http.post('/api/client/auth/logout');
}

export async function requestPasswordReset(email: string): Promise<void> {
  await http.post('/api/client/auth/password', { email });
}

export interface PerformPasswordResetRequest {
  email: string;
  password: string;
  password_confirmation: string;
  token: string;
}

export async function performPasswordReset(payload: PerformPasswordResetRequest): Promise<void> {
  await http.post('/api/client/auth/password/reset', payload);
}

/**
 * Create a client API key for the current user. After login (which uses
 * cookies), we immediately call this to get a bearer token — subsequent
 * requests use the token instead of cookies, avoiding cross-site cookie
 * issues (third-party cookie blocking, SameSite=None restrictions, etc.).
 *
 * The response shape is:
 *   { object: "api_key", attributes: { identifier, ... }, meta: { secret_token: "ptlc_..." } }
 *
 * Returns the full API key (the secret_token from meta) — store in
 * localStorage + use as Authorization: Bearer for all future requests.
 */
export async function createApiKey(description: string): Promise<string> {
  const res = await http.post<unknown>('/api/client/account/api-keys', {
    description,
    allowed_ips: [],
  });
  const data = res.data as {
    attributes?: { identifier?: string };
    meta?: { secret_token?: string };
  };
  const secretToken = data.meta?.secret_token;
  if (!secretToken) {
    throw new Error('Failed to create API key — missing secret_token in meta');
  }
  return secretToken;
}

/** Delete a client API key by its identifier (used at logout). */
export async function deleteApiKey(identifier: string): Promise<void> {
  await http.delete(`/api/client/account/api-keys/${identifier}`);
}

function normalizeLoginResponse(data: unknown): LoginResponse {
  if (typeof data !== 'object' || data === null) {
    return { complete: true };
  }
  const obj = data as Record<string, unknown>;
  // Wrapped: { data: { complete, ... } }
  if (typeof obj.data === 'object' && obj.data !== null) {
    const inner = obj.data as Record<string, unknown>;
    return {
      complete: typeof inner.complete === 'boolean' ? inner.complete : true,
      confirmation_token: typeof inner.confirmation_token === 'string' ? inner.confirmation_token : undefined,
      intended: typeof inner.intended === 'string' ? inner.intended : undefined,
      user: typeof inner.user === 'object' && inner.user !== null
        ? (inner.user as LoginUser)
        : undefined,
    };
  }
  // Bare: { complete, ... }
  return {
    complete: typeof obj.complete === 'boolean' ? obj.complete : true,
    confirmation_token: typeof obj.confirmation_token === 'string' ? obj.confirmation_token : undefined,
    intended: typeof obj.intended === 'string' ? obj.intended : undefined,
    user: typeof obj.user === 'object' && obj.user !== null
      ? (obj.user as LoginUser)
      : undefined,
  };
}
