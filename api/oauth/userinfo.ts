import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAccessToken, getUserById } from '../_oauth-store';

/**
 * OAuth UserInfo Endpoint
 * GET /api/oauth/userinfo
 * Returns the authenticated user's profile.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  // Extract Bearer token
  const authHeader = req.headers['authorization'] || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Missing or malformed Authorization header',
    });
  }

  const accessToken = match[1];
  const tokenRecord = await getAccessToken(accessToken);
  if (!tokenRecord) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Token expired, revoked, or invalid',
    });
  }

  // Get user info
  const user = await getUserById(tokenRecord.user_id);
  if (!user) {
    return res.status(404).json({
      error: 'user_not_found',
      error_description: 'Token is valid but user no longer exists',
    });
  }

  const scope = tokenRecord.scope || 'profile';
  const profile: any = {
    id: `user_${user.id}`,
    sub: `user_${user.id}`,
    username: user.username,
    role: user.root_admin == 1 ? 'superadmin' : 'member',
    status: 'active',
    scope,
  };

  // Add email if scope includes it
  if (scope.includes('email')) {
    profile.email = user.email;
  }

  // Add profile fields
  if (scope.includes('profile')) {
    profile.memberNumber = `DL-${new Date().getFullYear()}-${user.id.toString(16).toUpperCase().padStart(5, '0')}`;
    profile.verificationStatus = user.root_admin == 1 ? 'verified' : 'pending';
    profile.joinedAt = new Date().toISOString();
  }

  // Add identity fields
  if (scope.includes('identity')) {
    profile.memberId = `mem_${user.id}`;
    profile.verificationStatus = user.root_admin == 1 ? 'verified' : 'pending';
  }

  // Add unit fields
  if (scope.includes('unit')) {
    profile.primaryUnit = {
      id: `unit_${user.id}`,
      name: user.root_admin == 1 ? 'Administration' : 'Development',
      slug: user.root_admin == 1 ? 'administration' : 'development',
      color: user.root_admin == 1 ? '#ef4444' : '#22c55e',
    };
    profile.currentRole = user.root_admin == 1 ? 'Administrator' : 'Member';
  }

  return res.status(200).json(profile);
}

export const config = { api: { bodyParser: false }, maxDuration: 15 };
