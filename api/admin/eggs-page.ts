import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send('Access Denied');

  const eggs = await mysqlQueryJson('SELECT e.id, e.uuid, e.name, e.description, n.name as nest, e.author, e.docker_image, COUNT(s.id) as server_count FROM eggs e LEFT JOIN nests n ON e.nest_id = n.id LEFT JOIN servers s ON s.egg_id = e.id GROUP BY e.id ORDER BY e.id');

  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin — Eggs</title><style>${DESIGN_SYSTEM_CSS}
    .data-table{width:100%;border-collapse:collapse}.data-table th{text-align:left;padding:0.6rem 0.9rem;background:rgba(15,15,15,0.6);color:var(--dl-text-muted);font-size:0.68rem;text-transform:uppercase;border-bottom:1px solid var(--dl-border)}.data-table td{padding:0.6rem 0.9rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.8rem}.data-table tr:hover td{background:rgba(188,110,60,0.04)}.data-table .mono{font-family:var(--dl-font-mono);font-size:0.72rem;color:var(--dl-text-muted)}
    .table-wrap{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);overflow:hidden;backdrop-filter:blur(12px)}
    .table-wrap .table-header{padding:1rem 1.2rem;border-bottom:1px solid var(--dl-border);display:flex;align-items:center;justify-content:space-between}
    .action-btn{padding:0.3rem 0.6rem;background:rgba(188,110,60,0.1);border:1px solid rgba(188,110,60,0.2);border-radius:5px;color:var(--dl-bronze-light);font-size:0.68rem;text-decoration:none;display:inline-block}
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/eggs')}
  <div class="dl-container">
    <div class="dl-hero"><h1>Eggs (${eggs.length})</h1><p>Server templates available for deployment.</p></div>
    <div class="table-wrap"><div class="table-header"><h3>All Eggs</h3><a href="/admin" class="action-btn">← Back</a></div>
      <div style="overflow-x:auto;"><table class="data-table">
        <thead><tr><th>ID</th><th>Name</th><th>Nest</th><th>Author</th><th>Docker Image</th><th> Servers</th><th>Description</th></tr></thead>
        <tbody>
          ${eggs.map(e=>`<tr><td class="mono">${e.id}</td><td><strong>${e.name}</strong></td><td>${e.nest||'—'}</td><td style="color:var(--dl-text-muted);">${e.author||'—'}</td><td class="mono">${e.docker_image||'—'}</td><td>${e.server_count||0}</td><td style="color:var(--dl-text-muted);max-width:300px;">${(e.description||'').substring(0,80)}</td></tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No eggs</td></tr>'}
        </tbody>
      </table></div></div>
  </div></body></html>`);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
