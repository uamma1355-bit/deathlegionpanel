import type { VercelRequest, VercelResponse } from '@vercel/node';
import { executeTool, TOOL_DEFINITIONS } from './_agent-tools';

/**
 * Direct Tool Execution API
 * =========================
 * Lets the agent page execute tools directly — no LLM round-trip required.
 * This makes the agent FULLY FUNCTIONAL even when no Z.ai API key is configured.
 *
 * POST /api/agent-tools
 *   { "tool": "list_servers", "args": {} }
 *   → { "ok": true, "result": {...} }
 *
 * GET /api/agent-tools
 *   → { "tools": [...] }  (catalog for the UI)
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-XSRF-TOKEN');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET → return tool catalog
  if (req.method === 'GET') {
    return res.status(200).json({
      tools: TOOL_DEFINITIONS.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tool, args } = req.body || {};
  if (!tool) return res.status(400).json({ ok: false, error: 'tool parameter required' });

  const t0 = Date.now();
  const result = await executeTool(req, tool, args || {});
  const duration_ms = Date.now() - t0;

  return res.status(200).json({
    ok: result.ok !== false,
    tool,
    args,
    result,
    duration_ms,
  });
}

export const config = { api: { bodyParser: true, sizeLimit: '10mb' }, maxDuration: 60 };
