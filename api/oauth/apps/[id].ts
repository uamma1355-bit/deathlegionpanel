import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  updateApp, deleteApp, getAppById, getUserIdFromCookies, getUserById, initTables,
} from '../../_oauth-store';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-XSRF-TOKEN');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    await initTables();

    const cookieHeader = (req.headers['cookie'] as string) || '';
    const xsrfToken = (req.headers['x-xsrf-token'] as string) || '';
    const userId = await getUserIdFromCookies(cookieHeader, xsrfToken);
    if (!userId) return res.status(401).json({ error: 'login_required', error_description: 'Must be logged in' });

    const user = await getUserById(userId);
    if (!user || user.root_admin != 1) {
      return res.status(403).json({ error: 'access_denied', error_description: 'Admin access required' });
    }

    const { id } = req.query as any;
    const appId = parseInt(id);
    if (!appId) return res.status(400).json({ error: 'invalid_request', error_description: 'Invalid app ID' });

    const existing = await getAppById(appId);
    if (!existing) return res.status(404).json({ error: 'not_found', error_description: 'App not found' });

    if (req.method === 'PATCH') {
      const { name, description, homepageUrl, logoUrl, redirectUris, active, rotateSecret } = req.body || {};
      const app = await updateApp(appId, {
        name, description, homepageUrl, logoUrl,
        redirectUris: Array.isArray(redirectUris) ? redirectUris : undefined,
        active: typeof active === 'boolean' ? active : undefined,
        rotateSecret: !!rotateSecret,
      });
      return res.status(200).json({ app });
    }

    if (req.method === 'DELETE') {
      await deleteApp(appId);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e: any) {
    console.error('OAuth apps [id] API error:', e);
    return res.status(500).json({ error: 'server_error', error_description: e?.message || String(e) });
  }
}

export const config = { api: { bodyParser: true }, maxDuration: 60 };
