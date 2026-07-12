import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send('Access Denied');

  const apps = await mysqlQueryJson('SELECT a.id, a.first_name, a.last_name, a.username, a.email, a.status, a.created_at, a.reviewed_at FROM applications a ORDER BY a.id DESC LIMIT 100');

  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin — Applications</title><style>${DESIGN_SYSTEM_CSS}
    .data-table{width:100%;border-collapse:collapse}.data-table th{text-align:left;padding:0.5rem 0.8rem;background:rgba(15,15,15,0.6);color:var(--dl-text-muted);font-size:0.65rem;text-transform:uppercase;border-bottom:1px solid var(--dl-border)}.data-table td{padding:0.5rem 0.8rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78rem}.data-table tr:hover td{background:rgba(188,110,60,0.04)}.data-table .mono{font-family:var(--dl-font-mono);font-size:0.72rem;color:var(--dl-text-muted)}
    .table-wrap{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);overflow:hidden;backdrop-filter:blur(12px)}
    .table-wrap .table-header{padding:1rem 1.2rem;border-bottom:1px solid var(--dl-border);display:flex;align-items:center;justify-content:space-between}
    .action-btn{padding:0.3rem 0.6rem;background:rgba(188,110,60,0.1);border:1px solid rgba(188,110,60,0.2);border-radius:5px;color:var(--dl-bronze-light);font-size:0.68rem;cursor:pointer;text-decoration:none;display:inline-block;margin-right:0.2rem}
    .badge{padding:2px 7px;border-radius:5px;font-size:0.58rem;font-weight:700;text-transform:uppercase}.badge.pending{background:rgba(234,179,8,0.15);color:var(--dl-yellow)}.badge.approved{background:rgba(34,197,94,0.15);color:var(--dl-green)}.badge.rejected{background:rgba(239,68,68,0.15);color:var(--dl-red)}
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/applications')}
  <div class="dl-container">
    <div class="dl-hero"><h1>Applications (${apps.length})</h1><p>Review user signup applications.</p></div>
    <div class="table-wrap"><div class="table-header"><h3>All Applications</h3><a href="/admin" class="action-btn">← Back</a></div>
      <div style="overflow-x:auto;"><table class="data-table">
        <thead><tr><th>ID</th><th>Name</th><th>Username</th><th>Email</th><th>Status</th><th>Applied</th><th>Reviewed</th></tr></thead>
        <tbody>${apps.map(a=>`<tr><td class="mono">${a.id}</td><td>${a.first_name||''} ${a.last_name||''}</td><td><strong>${a.username}</strong></td><td style="color:var(--dl-text-muted);">${a.email}</td><td><span class="badge ${a.status||'pending'}">${a.status||'pending'}</span></td><td class="mono">${(a.created_at||'').split(' ')[0]}</td><td class="mono">${a.reviewed_at?(a.reviewed_at).split(' ')[0]:'—'}</td></tr>`).join('')||'<tr><td colspan="7" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No applications</td></tr>'}</tbody>
      </table></div></div>
  </div></body></html>`);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
