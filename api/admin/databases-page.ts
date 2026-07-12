import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send('Access Denied');

  const [dbHosts, databases] = await Promise.all([
    mysqlQueryJson('SELECT dh.id, dh.name, dh.host, dh.port, dh.username, dh.max_databases, COUNT(d.id) as db_count FROM database_hosts dh LEFT JOIN databases d ON d.database_host_id = dh.id GROUP BY dh.id'),
    mysqlQueryJson('SELECT d.id, d.database, d.username, s.name as server, dh.name as host FROM databases d LEFT JOIN servers s ON d.server_id = s.id LEFT JOIN database_hosts dh ON d.database_host_id = dh.id ORDER BY d.id DESC LIMIT 100'),
  ]);

  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin — Databases</title><style>${DESIGN_SYSTEM_CSS}
    .data-table{width:100%;border-collapse:collapse}.data-table th{text-align:left;padding:0.6rem 0.9rem;background:rgba(15,15,15,0.6);color:var(--dl-text-muted);font-size:0.68rem;text-transform:uppercase;border-bottom:1px solid var(--dl-border)}.data-table td{padding:0.6rem 0.9rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.8rem}.data-table tr:hover td{background:rgba(188,110,60,0.04)}.data-table .mono{font-family:var(--dl-font-mono);font-size:0.72rem;color:var(--dl-text-muted)}
    .table-wrap{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);overflow:hidden;backdrop-filter:blur(12px);margin-bottom:1rem}
    .table-wrap .table-header{padding:1rem 1.2rem;border-bottom:1px solid var(--dl-border);display:flex;align-items:center;justify-content:space-between}
    .action-btn{padding:0.3rem 0.6rem;background:rgba(188,110,60,0.1);border:1px solid rgba(188,110,60,0.2);border-radius:5px;color:var(--dl-bronze-light);font-size:0.68rem;text-decoration:none;display:inline-block}
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/databases')}
  <div class="dl-container">
    <div class="dl-hero"><h1>Databases</h1><p>Database hosts and user databases.</p></div>
    <div class="table-wrap"><div class="table-header"><h3>Database Hosts (${dbHosts.length})</h3><a href="/admin" class="action-btn">← Back</a></div>
      <div style="overflow-x:auto;"><table class="data-table">
        <thead><tr><th>ID</th><th>Name</th><th>Host</th><th>Port</th><th>Username</th><th>Max DBs</th><th>Used</th></tr></thead>
        <tbody>${dbHosts.map(h=>`<tr><td class="mono">${h.id}</td><td><strong>${h.name}</strong></td><td class="mono">${h.host}</td><td class="mono">${h.port}</td><td>${h.username}</td><td>${h.max_databases}</td><td>${h.db_count||0}</td></tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No DB hosts</td></tr>'}</tbody>
      </table></div></div>
    <div class="table-wrap"><div class="table-header"><h3>User Databases (${databases.length})</h3></div>
      <div style="overflow-x:auto;"><table class="data-table">
        <thead><tr><th>ID</th><th>Database</th><th>Username</th><th>Server</th><th>Host</th></tr></thead>
        <tbody>${databases.map(d=>`<tr><td class="mono">${d.id}</td><td><strong>${d.database}</strong></td><td>${d.username}</td><td>${d.server||'—'}</td><td>${d.host||'—'}</td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No databases</td></tr>'}</tbody>
      </table></div></div>
  </div></body></html>`);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
