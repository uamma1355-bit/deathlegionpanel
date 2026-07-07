import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_PANEL_URL = 'https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu';
const GITHUB_REPO = 'uamma1355-bit/deathlegionpanel';
const GITHUB_TOKEN = process.env.GH_TOKEN || process.env.GITHUB_PAT || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const start = Date.now();

  // 1. Check if panel is reachable
  let panelStatus: 'healthy' | 'unhealthy' = 'unhealthy';
  let panelHttpCode = 0;
  let panelResponseTime = 0;
  let panelError = '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(DAYTONA_PANEL_URL + '/', {
      method: 'GET',
      signal: controller.signal,
      headers: { 'User-Agent': 'Vercel-HealthCheck/1.0' },
    });
    clearTimeout(timeout);
    panelHttpCode = resp.status;
    panelResponseTime = Date.now() - start;
    panelStatus = resp.ok ? 'healthy' : 'unhealthy';
  } catch (e) {
    panelError = e instanceof Error ? e.message : String(e);
    panelResponseTime = Date.now() - start;
  }

  // 2. Check API endpoint
  let apiStatus = 'unhealthy';
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const resp = await fetch(DAYTONA_PANEL_URL + '/api/client/account', {
      signal: controller.signal,
      headers: { 'User-Agent': 'Vercel-HealthCheck/1.0' },
    });
    clearTimeout(timeout);
    apiStatus = resp.status === 401 || resp.status === 200 ? 'healthy' : 'unhealthy';
  } catch {
    // ignore
  }

  // 3. Check GitHub Actions self-heal workflow status
  let healStatus: 'running' | 'completed' | 'failed' | 'unknown' = 'unknown';
  let healLastRun = '';
  let healLastRunUrl = '';
  let healLastRunConclusion = '';
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'Vercel-HealthCheck',
    };
    if (GITHUB_TOKEN) {
      headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
    }
    const resp = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/self-heal.yml/runs?per_page=3`,
      { headers }
    );
    if (resp.ok) {
      const data = await resp.json() as any;
      const runs = data.workflow_runs || [];
      if (runs.length > 0) {
        const latest = runs[0];
        healLastRun = latest.created_at;
        healLastRunUrl = latest.html_url;
        healLastRunConclusion = latest.conclusion || 'running';
        if (latest.status === 'in_progress' || latest.status === 'queued') {
          healStatus = 'running';
        } else if (latest.conclusion === 'success') {
          healStatus = 'completed';
        } else if (latest.conclusion === 'failure') {
          healStatus = 'failed';
        } else {
          healStatus = 'completed';
        }
      }
    }
  } catch {
    // ignore — GitHub API may rate-limit without token
  }

  // 4. Determine overall state
  const overall = panelStatus === 'healthy' && apiStatus === 'healthy' ? 'healthy' : 'healing';

  return res.status(200).json({
    status: overall,
    panel: {
      url: DAYTONA_PANEL_URL,
      status: panelStatus,
      http_code: panelHttpCode,
      response_time_ms: panelResponseTime,
      error: panelError || undefined,
    },
    api: {
      status: apiStatus,
    },
    self_heal: {
      status: healStatus,
      last_run: healLastRun,
      last_run_conclusion: healLastRunConclusion,
      last_run_url: healLastRunUrl,
      interval: '5min',
      next_check: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      workflow: 'self-heal.yml',
      repo: GITHUB_REPO,
    },
    timestamp: new Date().toISOString(),
  });
}
