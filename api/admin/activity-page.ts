import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send('Access Denied');

  const logs = await mysqlQueryJson('SELECT al.id, al.actor_id, al.event, al.description, al.properties, al.created_at, u.username as actor FROM activity_logs al LEFT JOIN users u ON al.actor_id = u.id ORDER BY al.id DESC LIMIT 200');

  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin — Activity Log</title><style>${DESIGN_SYSTEM_CSS}
    .data-table{width:100%;border-collapse:collapse}.data-table th{text-align:left;padding:0.5rem 0.8rem;background:rgba(15,15,15,0.6);color:var(--dl-text-muted);font-size:0.65rem;text-transform:uppercase;border-bottom:1px solid var(--dl-border)}.data-table td{padding:0.5rem 0.8rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78rem}.data-table tr:hover td{background:rgba(188,110,60,0.04)}.data-table .mono{font-family:var(--dl-font-mono);font-size:0.72rem;color:var(--dl-text-muted)}
    .table-wrap{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);overflow:hidden;backdrop-filter:blur(12px)}
    .table-wrap .table-header{padding:1rem 1.2rem;border-bottom:1px solid var(--dl-border);display:flex;align-items:center;justify-content:space-between}
    .action-btn{padding:0.3rem 0.6rem;background:rgba(188,110,60,0.1);border:1px solid rgba(188,110,60,0.2);border-radius:5px;color:var(--dl-bronze-light);font-size:0.68rem;text-decoration:none;display:inline-block}
    .event-badge{padding:2px 7px;border-radius:5px;font-size:0.58rem;font-weight:700;text-transform:uppercase}.event-badge.admin{background:rgba(239,68,68,0.15);color:var(--dl-red)}.event-badge.user{background:rgba(59,130,246,0.15);color:var(--dl-blue)}.event-badge.server{background:rgba(34,197,94,0.15);color:var(--dl-green)}
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/activity')}
  <div class="dl-container">
    <div class="dl-hero"><h1>Activity Log (${logs.length})</h1><p>Audit trail of all platform actions.</p></div>
    <div class="table-wrap"><div class="table-header"><h3>Recent Activity</h3><a href="/admin" class="action-btn">← Back</a></div>
      <div style="overflow-x:auto;"><table class="data-table">
        <thead><tr><th>ID</th><th>Time</th><th>Actor</th><th>Event</th><th>Description</th></tr></thead>
        <tbody>${logs.map(l=>{const ev=l.event||'';const cls=ev.startsWith('admin')?'admin':ev.startsWith('server')?'server':'user';return `<tr><td class="mono">${l.id}</td><td class="mono">${(l.created_at||'').split('.')[0]}</td><td>${l.actor||'system'}</td><td><span class="event-badge ${cls}">${ev}</span></td><td style="color:var(--dl-text-muted);">${l.description||''}</td></tr>`;}).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No activity yet</td></tr>'}</tbody>
      </table></div></div>
  </div></body></html>`);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
