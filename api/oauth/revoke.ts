import type { VercelRequest, VercelResponse } from '@vercel/node';
import { revokeToken } from '../_oauth-store';

/**
 * OAuth Token Revocation (RFC 7009)
 * POST /api/oauth/revoke
 * Revoke an access or refresh token.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const { token } = req.body || {};

  if (!token) return res.status(400).json({ error: 'invalid_request', error_description: 'Missing token' });

  // Revoke (works for both access and refresh tokens)
  await revokeToken(token);

  // RFC 7009: always return 200 regardless
  return res.status(200).json({});
}

export const config = { api: { bodyParser: true }, maxDuration: 15 };
