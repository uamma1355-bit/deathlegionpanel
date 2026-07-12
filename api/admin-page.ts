import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from './_design';
import { mysqlQueryJson, verifyAdmin } from './_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  // SECURITY: verify admin
  const admin = await verifyAdmin(req);
  if (!admin) {
    return res.status(403).send(renderAccessDenied());
  }

  // Get all stats in parallel
  const [users, servers, nodes, allocations, eggs, locations, dbHosts, apiKeys, activityLogs, announcements] = await Promise.all([
    mysqlQueryJson('SELECT COUNT(*) as count FROM users'),
    mysqlQueryJson('SELECT COUNT(*) as total, SUM(CASE WHEN status="running" THEN 1 ELSE 0 END) as running, SUM(CASE WHEN suspended=1 THEN 1 ELSE 0 END) as suspended FROM servers'),
    mysqlQueryJson('SELECT COUNT(*) as count FROM nodes'),
    mysqlQueryJson('SELECT COUNT(*) as total, SUM(CASE WHEN server_id IS NULL THEN 1 ELSE 0 END) as available FROM allocations'),
    mysqlQueryJson('SELECT COUNT(*) as count FROM eggs'),
    mysqlQueryJson('SELECT COUNT(*) as count FROM locations'),
    mysqlQueryJson('SELECT COUNT(*) as count FROM database_hosts'),
    mysqlQueryJson('SELECT COUNT(*) as count FROM api_keys'),
    mysqlQueryJson('SELECT COUNT(*) as count FROM activity_logs'),
    mysqlQueryJson('SELECT COUNT(*) as count FROM dl_announcements WHERE active=1'),
  ]);

  const recentUsers = await mysqlQueryJson('SELECT id, username, email, root_admin, created_at FROM users ORDER BY id DESC LIMIT 5');
  const recentServers = await mysqlQueryJson('SELECT s.id, s.uuidShort, s.name, s.status, u.username as owner FROM servers s LEFT JOIN users u ON s.owner_id = u.id ORDER BY s.id DESC LIMIT 5');
  const recentActivity = await mysqlQueryJson('SELECT al.actor_id, al.event, al.description, al.created_at, u.username as actor FROM activity_logs al LEFT JOIN users u ON al.actor_id = u.id ORDER BY al.id DESC LIMIT 10');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — Admin</title>
  <style>${DESIGN_SYSTEM_CSS}
    .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(120px,1fr)); gap:0.8rem; margin-bottom:1.5rem; }
    .stat-card { background:var(--dl-bg-card); backdrop-filter:blur(12px); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); padding:1.2rem; text-align:center; transition:var(--dl-transition); text-decoration:none; color:inherit; }
    .stat-card:hover { border-color:var(--dl-border-hover); transform:translateY(-2px); box-shadow:var(--dl-shadow); }
    .stat-card .icon { font-size:1.5rem; margin-bottom:0.2rem; }
    .stat-card .value { font-family:var(--dl-font-mono); font-size:1.6rem; font-weight:700; color:var(--dl-bronze-light); }
    .stat-card .label { color:var(--dl-text-dim); font-size:0.65rem; text-transform:uppercase; letter-spacing:0.08em; margin-top:0.2rem; }
    .admin-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:0.8rem; margin-bottom:1.5rem; }
    .admin-card { background:var(--dl-bg-card); backdrop-filter:blur(12px); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); padding:1.2rem; text-decoration:none; color:inherit; transition:var(--dl-transition); display:flex; align-items:center; gap:0.8rem; }
    .admin-card:hover { border-color:var(--dl-border-hover); transform:translateY(-2px); box-shadow:var(--dl-shadow); }
    .admin-card .icon { font-size:1.5rem; }
    .admin-card .info h3 { font-size:0.9rem; color:var(--dl-text); margin-bottom:0.1rem; }
    .admin-card .info p { font-size:0.72rem; color:var(--dl-text-dim); }
    .table-wrap { background:var(--dl-bg-card); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); overflow:hidden; margin-bottom:1rem; backdrop-filter:blur(12px); }
    .table-wrap .table-header { padding:0.8rem 1.2rem; border-bottom:1px solid var(--dl-border); display:flex; align-items:center; justify-content:space-between; }
    .table-wrap .table-header h3 { font-family:var(--dl-font-display); color:var(--dl-bronze-light); font-size:0.85rem; letter-spacing:0.05em; text-transform:uppercase; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { text-align:left; padding:0.5rem 0.8rem; background:rgba(15,15,15,0.6); color:var(--dl-text-muted); font-size:0.65rem; text-transform:uppercase; letter-spacing:0.08em; border-bottom:1px solid var(--dl-border); }
    .data-table td { padding:0.5rem 0.8rem; border-bottom:1px solid rgba(255,255,255,0.04); font-size:0.78rem; }
    .data-table tr:hover td { background:rgba(188,110,60,0.04); }
    .data-table .mono { font-family:var(--dl-font-mono); font-size:0.72rem; color:var(--dl-text-muted); }
    .admin-badge { background:rgba(239,68,68,0.15); color:var(--dl-red); padding:2px 6px; border-radius:6px; font-size:0.58rem; font-weight:700; text-transform:uppercase; }
    .two-col { display:grid; grid-template-columns:1fr 1fr; gap:1rem; margin-bottom:1rem; }
    @media (max-width:768px) { .two-col { grid-template-columns:1fr; } }
    .access-denied { display:flex; align-items:center; justify-content:center; min-height:100vh; }
  </style>
</head>
<body class="dl-bg">
  ${sharedHeader('/admin')}
  <div class="dl-container">
    <div class="dl-hero">
      <h1>Admin Dashboard</h1>
      <p>Logged in as <strong>${admin.username}</strong> · Full platform management</p>
    </div>

    <div class="stats-grid">
      <a href="/admin/users" class="stat-card"><div class="icon">👥</div><div class="value">${users[0]?.count || 0}</div><div class="label">Users</div></a>
      <a href="/admin/servers" class="stat-card"><div class="icon">🖥️</div><div class="value">${servers[0]?.total || 0}</div><div class="label">Servers</div></a>
      <a href="/admin/nodes" class="stat-card"><div class="icon">🌐</div><div class="value">${nodes[0]?.count || 0}</div><div class="label">Nodes</div></a>
      <div class="stat-card"><div class="icon">🔌</div><div class="value">${allocations[0]?.available || 0}/${allocations[0]?.total || 0}</div><div class="label">Free Ports</div></div>
      <a href="/admin/eggs" class="stat-card"><div class="icon">🥚</div><div class="value">${eggs[0]?.count || 0}</div><div class="label">Eggs</div></a>
      <a href="/admin/locations" class="stat-card"><div class="icon">📍</div><div class="value">${locations[0]?.count || 0}</div><div class="label">Locations</div></a>
      <a href="/admin/databases" class="stat-card"><div class="icon">🗄️</div><div class="value">${dbHosts[0]?.count || 0}</div><div class="label">DB Hosts</div></a>
      <a href="/admin/api-keys" class="stat-card"><div class="icon">🔑</div><div class="value">${apiKeys[0]?.count || 0}</div><div class="label">API Keys</div></a>
      <a href="/admin/activity" class="stat-card"><div class="icon">📋</div><div class="value">${activityLogs[0]?.count || 0}</div><div class="label">Activity Logs</div></a>
    </div>

    <h2 class="dl-section-title">Management</h2>
    <div class="admin-grid">
      <a href="/admin/users" class="admin-card"><div class="icon">👥</div><div class="info"><h3>Users</h3><p>Create, edit, suspend, delete</p></div></a>
      <a href="/admin/servers" class="admin-card"><div class="icon">🖥️</div><div class="info"><h3>Servers</h3><p>Create, edit, power, delete</p></div></a>
      <a href="/admin/nodes" class="admin-card"><div class="icon">🌐</div><div class="info"><h3>Nodes</h3><p>Manage compute nodes</p></div></a>
      <a href="/admin/allocations" class="admin-card"><div class="icon">🔌</div><div class="info"><h3>Allocations</h3><p>Port management</p></div></a>
      <a href="/admin/eggs" class="admin-card"><div class="icon">🥚</div><div class="info"><h3>Eggs</h3><p>Server templates</p></div></a>
      <a href="/admin/locations" class="admin-card"><div class="icon">📍</div><div class="info"><h3>Locations</h3><p>Geographic locations</p></div></a>
      <a href="/admin/databases" class="admin-card"><div class="icon">🗄️</div><div class="info"><h3>Databases</h3><p>DB hosts</p></div></a>
      <a href="/admin/settings" class="admin-card"><div class="icon">⚙️</div><div class="info"><h3>Settings</h3><p>Panel config</p></div></a>
      <a href="/admin/activity" class="admin-card"><div class="icon">📋</div><div class="info"><h3>Activity Log</h3><p>Audit trail</p></div></a>
      <a href="/admin/api-keys" class="admin-card"><div class="icon">🔑</div><div class="info"><h3>API Keys</h3><p>All user tokens</p></div></a>
      <a href="/admin/announcements" class="admin-card"><div class="icon">📢</div><div class="info"><h3>Announcements</h3><p>Broadcast messages</p></div></a>
      <a href="/admin/ip-bans" class="admin-card"><div class="icon">🚫</div><div class="info"><h3>IP Bans</h3><p>Block malicious IPs</p></div></a>
      <a href="/admin/applications" class="admin-card"><div class="icon">📝</div><div class="info"><h3>Applications</h3><p>Review pending apps</p></div></a>
      <a href="/admin/credits" class="admin-card"><div class="icon">💰</div><div class="info"><h3>Credits</h3><p>Adjust user credits</p></div></a>
      <a href="/oauth" class="admin-card"><div class="icon">🔐</div><div class="info"><h3>OAuth Apps</h3><p>Manage OAuth clients</p></div></a>
      <a href="/admin/security" class="admin-card"><div class="icon">🛡️</div><div class="info"><h3>Security</h3><p>2FA, sessions, audit</p></div></a>
    </div>

    <div class="two-col">
      <div class="table-wrap">
        <div class="table-header"><h3>Recent Users</h3><a href="/admin/users" style="color:var(--dl-bronze-light);font-size:0.72rem;text-decoration:none;">View All →</a></div>
        <table class="data-table">
          <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
          <tbody>
            ${recentUsers.map(u => `<tr><td><strong>${u.username}</strong></td><td style="color:var(--dl-text-muted);">${u.email}</td><td>${u.root_admin == 1 ? '<span class="admin-badge">Admin</span>' : 'User'}</td><td class="mono">${(u.created_at||'').split(' ')[0]}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="table-wrap">
        <div class="table-header"><h3>Recent Servers</h3><a href="/admin/servers" style="color:var(--dl-bronze-light);font-size:0.72rem;text-decoration:none;">View All →</a></div>
        <table class="data-table">
          <thead><tr><th>Name</th><th>Owner</th><th>Status</th><th>Console</th></tr></thead>
          <tbody>
            ${recentServers.map(s => `<tr><td><strong>${s.name}</strong></td><td>${s.owner||'—'}</td><td>${s.status||'offline'}</td><td><a href="/server/${s.uuidShort}" style="color:var(--dl-bronze-light);font-size:0.72rem;text-decoration:none;">Open →</a></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-header"><h3>Recent Activity</h3><a href="/admin/activity" style="color:var(--dl-bronze-light);font-size:0.72rem;text-decoration:none;">View All →</a></div>
      <table class="data-table">
        <thead><tr><th>Time</th><th>Actor</th><th>Event</th><th>Description</th></tr></thead>
        <tbody>
          ${recentActivity.map(a => `<tr><td class="mono">${(a.created_at||'').split('.')[0]}</td><td>${a.actor||'system'}</td><td><strong>${a.event||''}</strong></td><td style="color:var(--dl-text-muted);">${a.description||''}</td></tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--dl-text-dim);">No activity yet</td></tr>'}
        </tbody>
      </table>
    </div>

    <div class="dl-footer">
      <p>Admin actions are logged · <a href="/">Back to Panel</a></p>
    </div>
  </div>
</body>
</html>`;

  return res.status(200).send(html);
}

function renderAccessDenied(): string {
  return `<!DOCTYPE html><html><head><title>Access Denied</title>
  <style>
    body { background:#080808; color:#e5e5e5; font-family:system-ui; display:flex; align-items:center; justify-content:center; min-height:100vh; margin:0; }
    .card { background:rgba(20,20,20,0.9); border:1px solid rgba(239,68,68,0.2); border-radius:16px; padding:2.5rem; text-align:center; max-width:400px; }
    h1 { color:#ef4444; font-size:1.5rem; margin-bottom:0.5rem; }
    p { color:#888; margin-bottom:1.5rem; }
    a { color:#e89060; text-decoration:none; padding:0.6rem 1.5rem; background:rgba(188,110,60,0.1); border:1px solid rgba(188,110,60,0.3); border-radius:8px; display:inline-block; }
  </style></head>
  <body><div class="card">
    <h1>🛡️ Access Denied</h1>
    <p>You must be logged in as an admin to view this page.</p>
    <a href="/">← Back to Panel</a>
  </div></body></html>`;
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
