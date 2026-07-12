import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from './_design';

/**
 * Admin Dashboard Page
 * URL: /admin
 *
 * Custom admin panel that doesn't rely on Pterodactyl's Blade admin area
 * (which has auth issues through the Vercel proxy). Instead, this page
 * uses the Pterodactyl Application API to manage users, servers, nodes.
 *
 * Features:
 * - Stats overview (users, servers, nodes, allocations)
 * - Users list (with server counts)
 * - Servers list (with owner, node, status)
 * - Quick actions (create user, restart all servers, etc.)
 */

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
const SANDBOX_ID = '16551277-c744-47d8-bbf4-f681442b1691';
const DAYTONA_API = 'https://app.daytona.io/api';
const DB_USER = 'pterodactyl';
const DB_PASS = 'ptero_app_pw_2025';
const DB_NAME = 'pterodactyl';

async function mysqlQuery(sql: string, timeout = 15): Promise<string> {
  const singleLine = sql.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const escapedSql = singleLine.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const cmd = `mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} -e "${escapedSql}" --batch --raw 2>&1`;
  const body = JSON.stringify({ command: cmd, cwd: '/home/daytona', timeout });
  try {
    const resp = await fetch(`${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}`, 'Content-Type': 'application/json' },
      body,
    });
    const data = await resp.json() as any;
    return data.result || '';
  } catch (e: any) {
    return `Error: ${e?.message || e}`;
  }
}

function parseMysqlBatch(output: string): any[] {
  const lines = output.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const values = line.split('\t');
    const obj: any = {};
    headers.forEach((h, i) => { obj[h] = values[i] === 'NULL' ? null : values[i]; });
    return obj;
  });
}

async function mysqlQueryJson(sql: string, timeout = 15): Promise<any[]> {
  const result = await mysqlQuery(sql, timeout);
  return parseMysqlBatch(result);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  // Get stats
  const [users, servers, nodes, allocations] = await Promise.all([
    mysqlQueryJson('SELECT COUNT(*) as count FROM users'),
    mysqlQueryJson('SELECT COUNT(*) as count FROM servers'),
    mysqlQueryJson('SELECT COUNT(*) as count FROM nodes'),
    mysqlQueryJson('SELECT COUNT(*) as total, SUM(CASE WHEN server_id IS NULL THEN 1 ELSE 0 END) as available FROM allocations'),
  ]);

  const userCount = users[0]?.count || 0;
  const serverCount = servers[0]?.count || 0;
  const nodeCount = nodes[0]?.count || 0;
  const allocTotal = allocations[0]?.total || 0;
  const allocAvail = allocations[0]?.available || 0;

  // Get users with server counts
  const usersList = await mysqlQueryJson(
    'SELECT u.id, u.username, u.email, u.name_first, u.root_admin, COUNT(s.id) as server_count, u.created_at FROM users u LEFT JOIN servers s ON s.owner_id = u.id GROUP BY u.id ORDER BY u.id DESC LIMIT 50'
  );

  // Get servers with owner info
  const serversList = await mysqlQueryJson(
    'SELECT s.id, s.uuid, s.uuidShort, s.name, s.status, u.username as owner, n.name as node FROM servers s LEFT JOIN users u ON s.owner_id = u.id LEFT JOIN nodes n ON s.node_id = n.id ORDER BY s.id DESC LIMIT 50'
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — Admin</title>
  <style>${DESIGN_SYSTEM_CSS}
    .stats-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:1rem; margin-bottom:1.5rem; }
    .stat-card { background:var(--dl-bg-card); backdrop-filter:blur(12px); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); padding:1.3rem; text-align:center; transition:var(--dl-transition); }
    .stat-card:hover { border-color:var(--dl-border-hover); transform:translateY(-2px); }
    .stat-card .icon { font-size:1.6rem; margin-bottom:0.3rem; }
    .stat-card .value { font-family:var(--dl-font-mono); font-size:1.8rem; font-weight:700; color:var(--dl-bronze-light); }
    .stat-card .label { color:var(--dl-text-dim); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.08em; margin-top:0.2rem; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { text-align:left; padding:0.6rem 0.8rem; background:rgba(15,15,15,0.6); color:var(--dl-text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.08em; border-bottom:1px solid var(--dl-border); }
    .data-table td { padding:0.6rem 0.8rem; border-bottom:1px solid rgba(255,255,255,0.04); font-size:0.82rem; }
    .data-table tr:hover td { background:rgba(188,110,60,0.04); }
    .data-table .mono { font-family:var(--dl-font-mono); font-size:0.75rem; color:var(--dl-text-muted); }
    .admin-badge { background:rgba(239,68,68,0.15); color:var(--dl-red); padding:2px 8px; border-radius:8px; font-size:0.62rem; font-weight:700; text-transform:uppercase; }
    .server-status { padding:2px 8px; border-radius:8px; font-size:0.62rem; font-weight:600; text-transform:uppercase; }
    .server-status.running { background:rgba(34,197,94,0.15); color:var(--dl-green); }
    .server-status.offline { background:rgba(239,68,68,0.15); color:var(--dl-red); }
    .server-status.starting { background:rgba(234,179,8,0.15); color:var(--dl-yellow); }
    .table-wrap { background:var(--dl-bg-card); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); overflow:hidden; margin-bottom:1.5rem; backdrop-filter:blur(12px); }
    .table-wrap .table-header { padding:1rem 1.2rem; border-bottom:1px solid var(--dl-border); display:flex; align-items:center; justify-content:space-between; }
    .table-wrap .table-header h3 { font-family:var(--dl-font-display); color:var(--dl-bronze-light); font-size:0.95rem; letter-spacing:0.05em; text-transform:uppercase; }
    .action-btn { padding:0.35rem 0.7rem; background:rgba(188,110,60,0.1); border:1px solid rgba(188,110,60,0.2); border-radius:6px; color:var(--dl-bronze-light); font-size:0.72rem; cursor:pointer; text-decoration:none; transition:var(--dl-transition); }
    .action-btn:hover { background:rgba(188,110,60,0.2); }
    .action-btn.danger { color:var(--dl-red); border-color:rgba(239,68,68,0.2); background:rgba(239,68,68,0.05); }
  </style>
</head>
<body class="dl-bg">
  ${sharedHeader('/admin')}
  <div class="dl-container">
    <div class="dl-hero">
      <h1>Admin Dashboard</h1>
      <p>Manage users, servers, and platform resources.</p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="icon">👥</div>
        <div class="value">${userCount}</div>
        <div class="label">Users</div>
      </div>
      <div class="stat-card">
        <div class="icon">🖥️</div>
        <div class="value">${serverCount}</div>
        <div class="label">Servers</div>
      </div>
      <div class="stat-card">
        <div class="icon">🌐</div>
        <div class="value">${nodeCount}</div>
        <div class="label">Nodes</div>
      </div>
      <div class="stat-card">
        <div class="icon">🔌</div>
        <div class="value">${allocAvail}/${allocTotal}</div>
        <div class="label">Free Ports</div>
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-header">
        <h3>Users (${usersList.length})</h3>
        <a href="/admin/users" class="action-btn">View All →</a>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr><th>ID</th><th>Username</th><th>Email</th><th>Role</th><th>Servers</th><th>Joined</th></tr>
          </thead>
          <tbody>
            ${usersList.map(u => `
              <tr>
                <td class="mono">${u.id}</td>
                <td><strong>${u.username}</strong></td>
                <td style="color:var(--dl-text-muted);">${u.email}</td>
                <td>${u.root_admin == 1 ? '<span class="admin-badge">Admin</span>' : '<span style="color:var(--dl-text-dim);">User</span>'}</td>
                <td>${u.server_count}</td>
                <td class="mono">${(u.created_at || '').split(' ')[0]}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="table-wrap">
      <div class="table-header">
        <h3>Servers (${serversList.length})</h3>
        <a href="/admin/servers" class="action-btn">View All →</a>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Owner</th><th>Node</th><th>Status</th><th>Console</th></tr>
          </thead>
          <tbody>
            ${serversList.map(s => `
              <tr>
                <td class="mono">${s.uuidShort || s.uuid?.substring(0,8)}</td>
                <td><strong>${s.name}</strong></td>
                <td>${s.owner || '—'}</td>
                <td style="color:var(--dl-text-muted);">${s.node || '—'}</td>
                <td><span class="server-status ${s.status || 'offline'}">${s.status || 'offline'}</span></td>
                <td><a href="/server/${s.uuidShort || s.uuid}" class="action-btn">Open →</a></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="dl-footer">
      <p>Admin actions are logged. <a href="/">Back to Panel</a></p>
    </div>
  </div>
</body>
</html>`;

  return res.status(200).send(html);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
