import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send('Access Denied');

  const [users2fa, apiKeys, recentLogins, suspendedUsers] = await Promise.all([
    mysqlQueryJson('SELECT id, username, email, use_totp, created_at FROM users WHERE use_totp=1 ORDER BY id DESC'),
    mysqlQueryJson('SELECT COUNT(*) as total, SUM(CASE WHEN expires_at IS NULL OR expires_at > NOW() THEN 1 ELSE 0 END) as active FROM api_keys'),
    mysqlQueryJson('SELECT al.actor_id, al.event, al.created_at, u.username FROM activity_logs al LEFT JOIN users u ON al.actor_id = u.id WHERE al.event LIKE "%login%" OR al.event LIKE "%auth%" ORDER BY al.id DESC LIMIT 20'),
    mysqlQueryJson('SELECT id, username, email, status FROM users WHERE status="suspended"'),
  ]);

  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin — Security</title><style>${DESIGN_SYSTEM_CSS}
    .stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;margin-bottom:1.5rem}
    .stat-card{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);padding:1.2rem;text-align:center;backdrop-filter:blur(12px)}
    .stat-card .icon{font-size:1.5rem;margin-bottom:0.2rem}.stat-card .value{font-family:var(--dl-font-mono);font-size:1.6rem;font-weight:700;color:var(--dl-bronze-light)}.stat-card .label{color:var(--dl-text-dim);font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em}
    .data-table{width:100%;border-collapse:collapse}.data-table th{text-align:left;padding:0.5rem 0.8rem;background:rgba(15,15,15,0.6);color:var(--dl-text-muted);font-size:0.65rem;text-transform:uppercase;border-bottom:1px solid var(--dl-border)}.data-table td{padding:0.5rem 0.8rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78rem}.data-table tr:hover td{background:rgba(188,110,60,0.04)}.data-table .mono{font-family:var(--dl-font-mono);font-size:0.72rem;color:var(--dl-text-muted)}
    .table-wrap{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);overflow:hidden;backdrop-filter:blur(12px);margin-bottom:1rem}
    .table-wrap .table-header{padding:1rem 1.2rem;border-bottom:1px solid var(--dl-border);display:flex;align-items:center;justify-content:space-between}
    .action-btn{padding:0.3rem 0.6rem;background:rgba(188,110,60,0.1);border:1px solid rgba(188,110,60,0.2);border-radius:5px;color:var(--dl-bronze-light);font-size:0.68rem;text-decoration:none;display:inline-block}
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/security')}
  <div class="dl-container">
    <div class="dl-hero"><h1>Security Center</h1><p>Monitor 2FA, sessions, and suspicious activity.</p></div>
    <div class="stats-grid">
      <div class="stat-card"><div class="icon">🔐</div><div class="value">${users2fa.length}</div><div class="label">2FA Users</div></div>
      <div class="stat-card"><div class="icon">🔑</div><div class="value">${apiKeys[0]?.active || 0}/${apiKeys[0]?.total || 0}</div><div class="label">Active API Keys</div></div>
      <div class="stat-card"><div class="icon">🚫</div><div class="value">${suspendedUsers.length}</div><div class="label">Suspended Users</div></div>
    </div>
    <div class="table-wrap"><div class="table-header"><h3>Users with 2FA Enabled</h3><a href="/admin" class="action-btn">← Back</a></div>
      <table class="data-table">
        <thead><tr><th>ID</th><th>Username</th><th>Email</th><th>Since</th></tr></thead>
        <tbody>${users2fa.map(u=>`<tr><td class="mono">${u.id}</td><td><strong>${u.username}</strong></td><td>${u.email}</td><td class="mono">${(u.created_at||'').split(' ')[0]}</td></tr>`).join('')||'<tr><td colspan="4" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No users with 2FA</td></tr>'}</tbody>
      </table></div>
    <div class="table-wrap"><div class="table-header"><h3>Suspended Users</h3></div>
      <table class="data-table">
        <thead><tr><th>ID</th><th>Username</th><th>Email</th></tr></thead>
        <tbody>${suspendedUsers.map(u=>`<tr><td class="mono">${u.id}</td><td><strong>${u.username}</strong></td><td>${u.email}</td></tr>`).join('')||'<tr><td colspan="3" style="text-align:center;color:var(--dl-green);padding:2rem;">No suspended users ✓</td></tr>'}</tbody>
      </table></div>
    <div class="table-wrap"><div class="table-header"><h3>Recent Auth Events</h3></div>
      <table class="data-table">
        <thead><tr><th>Time</th><th>User</th><th>Event</th></tr></thead>
        <tbody>${recentLogins.map(l=>`<tr><td class="mono">${(l.created_at||'').split('.')[0]}</td><td>${l.username||'—'}</td><td>${l.event}</td></tr>`).join('()||'<tr><td colspan="3" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No auth events</td></tr>')}</tbody>
      </table></div>
    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
      <a href="/admin/ip-bans" class="dl-btn dl-btn-outline">Manage IP Bans</a>
      <a href="/admin/api-keys" class="dl-btn dl-btn-outline">View All API Keys</a>
      <a href="/admin/activity" class="dl-btn dl-btn-outline">Full Activity Log</a>
    </div>
  </div></body></html>`);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
