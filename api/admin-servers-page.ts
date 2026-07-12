import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from './_design';

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
const SANDBOX_ID = '16551277-c744-47d8-bbf4-f681442b1691';
const DAYTONA_API = 'https://app.daytona.io/api';
const DB_USER = 'pterodactyl';
const DB_PASS = 'ptero_app_pw_2025';
const DB_NAME = 'pterodactyl';

async function mysqlQueryJson(sql: string, timeout = 15): Promise<any[]> {
  const singleLine = sql.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const escapedSql = singleLine.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const cmd = `mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} -e "${escapedSql}" --batch --raw 2>&1`;
  const body = JSON.stringify({ command: cmd, cwd: '/home/daytona', timeout });
  try {
    const resp = await fetch(`${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}`, 'Content-Type': 'application/json' }, body,
    });
    const data = await resp.json() as any;
    return parseMysqlBatch(data.result || '');
  } catch { return []; }
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const servers = await mysqlQueryJson(
    'SELECT s.id, s.uuid, s.uuidShort, s.name, s.status, s.memory, s.disk, s.cpu, u.username as owner, n.name as node, e.name as egg FROM servers s LEFT JOIN users u ON s.owner_id = u.id LEFT JOIN nodes n ON s.node_id = n.id LEFT JOIN eggs e ON s.egg_id = e.id ORDER BY s.id DESC'
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — Admin Servers</title>
  <style>${DESIGN_SYSTEM_CSS}
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { text-align:left; padding:0.7rem 0.9rem; background:rgba(15,15,15,0.6); color:var(--dl-text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.08em; border-bottom:1px solid var(--dl-border); }
    .data-table td { padding:0.7rem 0.9rem; border-bottom:1px solid rgba(255,255,255,0.04); font-size:0.82rem; }
    .data-table tr:hover td { background:rgba(188,110,60,0.04); }
    .data-table .mono { font-family:var(--dl-font-mono); font-size:0.75rem; color:var(--dl-text-muted); }
    .server-status { padding:2px 8px; border-radius:8px; font-size:0.62rem; font-weight:600; text-transform:uppercase; }
    .server-status.running { background:rgba(34,197,94,0.15); color:var(--dl-green); }
    .server-status.offline { background:rgba(239,68,68,0.15); color:var(--dl-red); }
    .server-status.starting { background:rgba(234,179,8,0.15); color:var(--dl-yellow); }
    .table-wrap { background:var(--dl-bg-card); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); overflow:hidden; backdrop-filter:blur(12px); }
    .table-wrap .table-header { padding:1rem 1.2rem; border-bottom:1px solid var(--dl-border); display:flex; align-items:center; justify-content:space-between; }
    .table-wrap .table-header h3 { font-family:var(--dl-font-display); color:var(--dl-bronze-light); font-size:0.95rem; letter-spacing:0.05em; text-transform:uppercase; }
    .action-btn { padding:0.35rem 0.7rem; background:rgba(188,110,60,0.1); border:1px solid rgba(188,110,60,0.2); border-radius:6px; color:var(--dl-bronze-light); font-size:0.72rem; cursor:pointer; text-decoration:none; transition:var(--dl-transition); display:inline-block; }
    .action-btn:hover { background:rgba(188,110,60,0.2); }
  </style>
</head>
<body class="dl-bg">
  ${sharedHeader('/admin/servers')}
  <div class="dl-container">
    <div class="dl-hero">
      <h1>Servers (${servers.length})</h1>
      <p>All game/bot servers on the platform.</p>
    </div>
    <div class="table-wrap">
      <div class="table-header">
        <h3>All Servers</h3>
        <a href="/admin" class="action-btn">← Back to Admin</a>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr><th>ID</th><th>Name</th><th>Owner</th><th>Node</th><th>Egg</th><th>Status</th><th>RAM</th><th>Disk</th><th>CPU</th><th>Console</th></tr>
          </thead>
          <tbody>
            ${servers.map(s => `
              <tr>
                <td class="mono">${s.uuidShort || s.uuid?.substring(0,8)}</td>
                <td><strong>${s.name}</strong></td>
                <td>${s.owner || '—'}</td>
                <td style="color:var(--dl-text-muted);">${s.node || '—'}</td>
                <td style="color:var(--dl-text-muted);">${s.egg || '—'}</td>
                <td><span class="server-status ${s.status || 'offline'}">${s.status || 'offline'}</span></td>
                <td class="mono">${s.memory || 0} MB</td>
                <td class="mono">${s.disk || 0} MB</td>
                <td class="mono">${s.cpu || 0}%</td>
                <td><a href="/server/${s.uuidShort || s.uuid}" class="action-btn">Open →</a></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
    <div class="dl-footer">
      <p><a href="/admin">← Back to Admin</a> · <a href="/">Panel</a></p>
    </div>
  </div>
</body>
</html>`;

  return res.status(200).send(html);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
