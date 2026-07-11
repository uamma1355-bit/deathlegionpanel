import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAccessToken, getRefreshToken, getAppByClientId } from '../_oauth-store';

/**
 * OAuth Token Introspection (RFC 7662)
 * POST /api/oauth/introspect
 * Validate a token and return its metadata.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { token, client_id, client_secret } = req.body || {};

  if (!token) return res.status(400).json({ error: 'invalid_request', error_description: 'Missing token' });
  if (!client_id || !client_secret) {
    return res.status(401).json({ error: 'invalid_client', error_description: 'Client authentication required' });
  }

  // Verify client
  const app = await getAppByClientId(client_id);
  if (!app || app.client_secret !== client_secret) {
    return res.status(401).json({ error: 'invalid_client', error_description: 'Invalid client credentials' });
  }

  // Try access token first
  const accessRecord = await getAccessToken(token);
  if (accessRecord) {
    const user = await import('../_oauth-store').then(m => m.getUserById(accessRecord.user_id));
    return res.status(200).json({
      active: true,
      scope: accessRecord.scope,
      client_id: accessRecord.client_id,
      username: user?.username,
      sub: `user_${accessRecord.user_id}`,
      exp: Math.floor(new Date(accessRecord.access_expires_at).getTime() / 1000),
      iat: Math.floor(Date.now() / 1000) - 3600,
      token_type: 'Bearer',
    });
  }

  // Try refresh token
  const refreshRecord = await getRefreshToken(token);
  if (refreshRecord) {
    return res.status(200).json({
      active: true,
      scope: refreshRecord.scope,
      client_id: refreshRecord.client_id,
      sub: `user_${refreshRecord.user_id}`,
      token_type: 'refresh_token',
    });
  }

  // Not active
  return res.status(200).json({ active: false });
}

export const config = { api: { bodyParser: true }, maxDuration: 15 };
