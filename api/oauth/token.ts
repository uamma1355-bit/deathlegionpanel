import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getAppByClientId, getAuthCode, markCodeUsed, getRefreshToken,
  revokeOldRefreshAndCreateNew, createTokens,
} from '../_oauth-store';

/**
 * OAuth Token Endpoint
 * POST /api/oauth/token
 *
 * grant_type=authorization_code — exchange code for tokens
 * grant_type=refresh_token — refresh an access token
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { grant_type, code, refresh_token, client_id, client_secret, redirect_uri } = req.body || {};

  if (!grant_type) return tokenError(res, 400, 'invalid_request', 'Missing grant_type');
  if (!client_id) return tokenError(res, 400, 'invalid_request', 'Missing client_id');
  if (!client_secret) return tokenError(res, 400, 'invalid_request', 'Missing client_secret');

  // Verify client credentials
  const app = await getAppByClientId(client_id);
  if (!app || app.client_secret !== client_secret) {
    return tokenError(res, 401, 'invalid_client', 'Invalid client credentials');
  }

  if (grant_type === 'authorization_code') {
    return handleAuthCodeGrant(req, res, app, code, redirect_uri);
  } else if (grant_type === 'refresh_token') {
    return handleRefreshGrant(res, app, refresh_token);
  } else {
    return tokenError(res, 400, 'unsupported_grant_type', 'Use authorization_code or refresh_token');
  }
}

async function handleAuthCodeGrant(
  req: VercelRequest, res: VercelResponse,
  app: any, code: string, redirect_uri: string
) {
  if (!code) return tokenError(res, 400, 'invalid_request', 'Missing code');
  if (!redirect_uri) return tokenError(res, 400, 'invalid_request', 'Missing redirect_uri');

  const authCode = await getAuthCode(code);
  if (!authCode) {
    return tokenError(res, 400, 'invalid_grant', 'Authorization code invalid, expired, or already used');
  }

  // Verify code belongs to this client
  if (authCode.client_id !== app.client_id) {
    return tokenError(res, 400, 'invalid_grant', 'Code was not issued to this client');
  }

  // Verify redirect URI matches
  if (authCode.redirect_uri !== redirect_uri) {
    return tokenError(res, 400, 'invalid_grant', 'Redirect URI mismatch');
  }

  // Mark code as used (single use)
  await markCodeUsed(code);

  // Create tokens
  const tokens = await createTokens({
    client_id: app.client_id,
    user_id: authCode.user_id,
    scope: authCode.scope,
  });

  return res.status(200).json({
    access_token: tokens.access_token,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: tokens.refresh_token,
    scope: authCode.scope,
  });
}

async function handleRefreshGrant(res: VercelResponse, app: any, refreshToken: string) {
  if (!refreshToken) return tokenError(res, 400, 'invalid_request', 'Missing refresh_token');

  const tokenRecord = await getRefreshToken(refreshToken);
  if (!tokenRecord) {
    return tokenError(res, 400, 'invalid_grant', 'Refresh token invalid or revoked');
  }

  // Verify token belongs to this client
  if (tokenRecord.client_id !== app.client_id) {
    return tokenError(res, 400, 'invalid_grant', 'Token was not issued to this client');
  }

  // Rotate: revoke old, create new
  const newTokens = await revokeOldRefreshAndCreateNew(refreshToken, {
    client_id: app.client_id,
    user_id: tokenRecord.user_id,
    scope: tokenRecord.scope,
  });

  return res.status(200).json({
    access_token: newTokens.access_token,
    token_type: 'Bearer',
    expires_in: 3600,
    refresh_token: newTokens.refresh_token,
    scope: tokenRecord.scope,
  });
}

function tokenError(res: VercelResponse, status: number, error: string, description: string) {
  return res.status(status).json({ error, error_description: description });
}

export const config = { api: { bodyParser: true }, maxDuration: 30 };
