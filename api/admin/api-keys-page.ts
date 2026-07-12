import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send('Access Denied');

  const keys = await mysqlQueryJson('SELECT k.id, k.user_id, k.identifier, k.memo, k.key_type, k.allowed_ips, k.expires_at, k.last_used_at, k.created_at, u.username FROM api_keys k LEFT JOIN users u ON k.user_id = u.id ORDER BY k.id DESC LIMIT 200');

  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin — API Keys</title><style>${DESIGN_SYSTEM_CSS}
    .data-table{width:100%;border-collapse:collapse}.data-table th{text-align:left;padding:0.5rem 0.8rem;background:rgba(15,15,15,0.6);color:var(--dl-text-muted);font-size:0.65rem;text-transform:uppercase;border-bottom:1px solid var(--dl-border)}.data-table td{padding:0.5rem 0.8rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78rem}.data-table tr:hover td{background:rgba(188,110,60,0.04)}.data-table .mono{font-family:var(--dl-font-mono);font-size:0.72rem;color:var(--dl-text-muted)}
    .table-wrap{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);overflow:hidden;backdrop-filter:blur(12px)}
    .table-wrap .table-header{padding:1rem 1.2rem;border-bottom:1px solid var(--dl-border);display:flex;align-items:center;justify-content:space-between}
    .action-btn{padding:0.3rem 0.6rem;background:rgba(188,110,60,0.1);border:1px solid rgba(188,110,60,0.2);border-radius:5px;color:var(--dl-bronze-light);font-size:0.68rem;cursor:pointer;text-decoration:none;display:inline-block}
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/api-keys')}
  <div class="dl-container">
    <div class="dl-hero"><h1>API Keys (${keys.length})</h1><p>All user API tokens.</p></div>
    <div class="table-wrap"><div class="table-header"><h3>All API Keys</h3><a href="/admin" class="action-btn">← Back</a></div>
      <div style="overflow-x:auto;"><table class="data-table">
        <thead><tr><th>ID</th><th>User</th><th>Identifier</th><th>Memo</th><th>Type</th><th>Last Used</th><th>Expires</th><th>Created</th></tr></thead>
        <tbody>${keys.map(k=>`<tr><td class="mono">${k.id}</td><td><strong>${k.username||'—'}</strong></td><td class="mono">${k.identifier}</td><td>${k.memo||'—'}</td><td>${k.key_type==1?'Client':'Application'}</td><td class="mono">${k.last_used_at||'never'}</td><td class="mono">${k.expires_at||'never'}</td><td class="mono">${(k.created_at||'').split(' ')[0]}</td></tr>`).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No API keys</td></tr>'}</tbody>
      </table></div></div>
  </div></body></html>`);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
