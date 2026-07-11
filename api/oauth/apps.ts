import type { VercelRequest, VercelResponse } from '@vercel/node';
import { listApps, createApp, updateApp, deleteApp, getAppById, getUserIdFromCookies } from '../_oauth-store';

/**
 * OAuth App Management API
 * GET    /api/oauth/apps           — list all apps (admin only)
 * POST   /api/oauth/apps           — create a new app
 * PATCH  /api/oauth/apps/[id]      — update an app
 * DELETE /api/oauth/apps/[id]      — delete an app
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-XSRF-TOKEN');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // Check admin auth
  const cookieHeader = (req.headers['cookie'] as string) || '';
  const xsrfToken = (req.headers['x-xsrf-token'] as string) || '';
  const userId = await getUserIdFromCookies(cookieHeader, xsrfToken);

  if (!userId) {
    return res.status(401).json({ error: 'login_required', error_description: 'Must be logged in' });
  }

  // Check if user is admin
  const { getUserById } = await import('../_oauth-store');
  const user = await getUserById(userId);
  if (!user || user.root_admin != 1) {
    return res.status(403).json({ error: 'access_denied', error_description: 'Admin access required' });
  }

  if (req.method === 'GET') {
    const apps = await listApps();
    return res.status(200).json({ apps });
  }

  if (req.method === 'POST') {
    const { name, description, homepageUrl, logoUrl, redirectUris } = req.body || {};
    if (!name || !redirectUris || !Array.isArray(redirectUris) || redirectUris.length === 0) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'name and redirectUris required' });
    }
    const app = await createApp({ name, description, homepageUrl, logoUrl, redirectUris });
    return res.status(201).json({ app });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}

export const config = { api: { bodyParser: true }, maxDuration: 30 };
