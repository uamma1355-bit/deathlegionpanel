import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAppByClientId, getUserIdFromCookies, createAuthCode } from '../_oauth-store';

/**
 * OAuth Authorize Endpoint
 * GET  /api/oauth/authorize — show consent info (JSON) or redirect to login
 * POST /api/oauth/authorize — submit user's approve/deny decision
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-XSRF-TOKEN');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'method_not_allowed' });
}

// === GET: return consent screen info as JSON ===
async function handleGet(req: VercelRequest, res: VercelResponse) {
  const {
    response_type,
    client_id,
    redirect_uri,
    scope = 'profile',
    state = '',
  } = req.query as any;

  if (!response_type) return oauthError(res, 400, 'invalid_request', 'Missing response_type');
  if (response_type !== 'code') return oauthError(res, 400, 'unsupported_response_type', 'Only code is supported');
  if (!client_id) return oauthError(res, 400, 'invalid_request', 'Missing client_id');
  if (!redirect_uri) return oauthError(res, 400, 'invalid_request', 'Missing redirect_uri');

  const app = await getAppByClientId(client_id);
  if (!app) return oauthError(res, 401, 'invalid_client', 'Unknown client_id');
  if (!app.active) return oauthError(res, 401, 'invalid_client', 'Client is disabled');

  if (!app.redirect_uris.includes(redirect_uri)) {
    return oauthError(res, 400, 'invalid_request', 'Redirect URI not registered');
  }

  const cookieHeader = (req.headers['cookie'] as string) || '';
  const xsrfToken = (req.headers['x-xsrf-token'] as string) || '';
  const userId = await getUserIdFromCookies(cookieHeader, xsrfToken);

  if (!userId) {
    return res.status(401).json({
      error: 'login_required',
      error_description: 'User must log in to authorize this app',
    });
  }

  return res.status(200).json({
    app: {
      name: app.name,
      description: app.description,
      logoUrl: app.logo_url,
      homepageUrl: app.homepage_url,
    },
    user: { id: userId },
    scope,
    state,
    clientId: client_id,
    redirectUri: redirect_uri,
  });
}

// === POST: submit approve/deny decision ===
async function handlePost(req: VercelRequest, res: VercelResponse) {
  const { clientId, redirectUri, scope, state, decision } = req.body || {};

  if (!clientId || !redirectUri || !decision) {
    return oauthError(res, 400, 'invalid_request', 'Missing required parameters');
  }

  const app = await getAppByClientId(clientId);
  if (!app) return oauthError(res, 401, 'invalid_client', 'Unknown client_id');

  if (!app.redirect_uris.includes(redirectUri)) {
    return oauthError(res, 400, 'invalid_request', 'Redirect URI not registered');
  }

  const cookieHeader = (req.headers['cookie'] as string) || '';
  const xsrfToken = (req.headers['x-xsrf-token'] as string) || '';
  const userId = await getUserIdFromCookies(cookieHeader, xsrfToken);

  if (!userId) {
    return oauthError(res, 401, 'login_required', 'User must log in to authorize this app');
  }

  if (decision === 'deny') {
    const denyUrl = new URL(redirectUri);
    denyUrl.searchParams.set('error', 'access_denied');
    denyUrl.searchParams.set('error_description', 'User denied the authorization request');
    if (state) denyUrl.searchParams.set('state', state);
    return res.status(403).json({
      error: 'access_denied',
      error_description: 'User denied the authorization request',
      redirect: denyUrl.toString(),
    });
  }

  const code = await createAuthCode({
    client_id: clientId,
    user_id: userId,
    redirect_uri: redirectUri,
    scope: scope || 'profile',
  });

  const codeUrl = new URL(redirectUri);
  codeUrl.searchParams.set('code', code);
  if (state) codeUrl.searchParams.set('state', state);

  return res.status(200).json({ redirect: codeUrl.toString() });
}

function oauthError(res: VercelResponse, status: number, error: string, description: string) {
  return res.status(status).json({ error, error_description: description });
}

export const config = { api: { bodyParser: true }, maxDuration: 30 };
