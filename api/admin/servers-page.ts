import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin, sqlEscape } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send(accessDenied());

  const search = (req.query.search as string) || '';
  let where = '';
  if (search) where = ` WHERE s.name LIKE '%${sqlEscape(search)}%' OR u.username LIKE '%${sqlEscape(search)}%'`;

  const servers = await mysqlQueryJson(
    `SELECT s.id, s.uuid, s.uuidShort, s.name, s.status, s.suspended, s.memory, s.disk, s.cpu, u.username as owner, u.id as owner_id, n.name as node, e.name as egg FROM servers s LEFT JOIN users u ON s.owner_id = u.id LEFT JOIN nodes n ON s.node_id = n.id LEFT JOIN eggs e ON s.egg_id = e.id${where} ORDER BY s.id DESC LIMIT 200`
  );

  res.status(200).send(`<!DOCTYPE html><html lang="en"><head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — Admin Servers</title>
  <style>${DESIGN_SYSTEM_CSS}
    .toolbar { display:flex; gap:0.5rem; margin-bottom:1rem; flex-wrap:wrap; }
    .toolbar input { flex:1; min-width:200px; padding:0.5rem 0.8rem; background:var(--dl-bg-input); border:1px solid var(--dl-border); border-radius:var(--dl-radius); color:var(--dl-text); font-size:0.85rem; }
    .data-table { width:100%; border-collapse:collapse; }
    .data-table th { text-align:left; padding:0.5rem 0.8rem; background:rgba(15,15,15,0.6); color:var(--dl-text-muted); font-size:0.65rem; text-transform:uppercase; letter-spacing:0.08em; border-bottom:1px solid var(--dl-border); }
    .data-table td { padding:0.5rem 0.8rem; border-bottom:1px solid rgba(255,255,255,0.04); font-size:0.78rem; }
    .data-table tr:hover td { background:rgba(188,110,60,0.04); }
    .data-table .mono { font-family:var(--dl-font-mono); font-size:0.72rem; color:var(--dl-text-muted); }
    .status-badge { padding:2px 7px; border-radius:6px; font-size:0.58rem; font-weight:700; text-transform:uppercase; }
    .status-badge.running { background:rgba(34,197,94,0.15); color:var(--dl-green); }
    .status-badge.offline { background:rgba(239,68,68,0.15); color:var(--dl-red); }
    .status-badge.suspended { background:rgba(234,179,8,0.15); color:var(--dl-yellow); }
    .table-wrap { background:var(--dl-bg-card); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); overflow:hidden; backdrop-filter:blur(12px); }
    .table-wrap .table-header { padding:1rem 1.2rem; border-bottom:1px solid var(--dl-border); display:flex; align-items:center; justify-content:space-between; }
    .action-btn { padding:0.3rem 0.6rem; background:rgba(188,110,60,0.1); border:1px solid rgba(188,110,60,0.2); border-radius:5px; color:var(--dl-bronze-light); font-size:0.68rem; cursor:pointer; text-decoration:none; display:inline-block; margin-right:0.15rem; }
    .action-btn:hover { background:rgba(188,110,60,0.2); }
    .action-btn.danger { color:var(--dl-red); border-color:rgba(239,68,68,0.2); background:rgba(239,68,68,0.05); }
    .power-btn { padding:0.25rem 0.5rem; border-radius:4px; border:1px solid; font-size:0.62rem; cursor:pointer; margin-right:0.15rem; }
    .power-btn.start { color:#22c55e; border-color:rgba(34,197,94,0.3); background:rgba(34,197,94,0.05); }
    .power-btn.stop { color:#ef4444; border-color:rgba(239,68,68,0.3); background:rgba(239,68,68,0.05); }
    .power-btn.restart { color:#eab308; border-color:rgba(234,179,8,0.3); background:rgba(234,179,8,0.05); }
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/servers')}
  <div class="dl-container">
    <div class="dl-hero"><h1>Servers (${servers.length})</h1><p>Manage all game/bot servers.</p></div>
    <div class="toolbar">
      <form method="GET" style="flex:1;display:flex;gap:0.5rem;">
        <input type="text" name="search" placeholder="Search by name or owner..." value="${search.replace(/"/g,'&quot;')}" />
        <button type="submit" class="dl-btn dl-btn-primary">Search</button>
      </form>
      <button class="dl-btn dl-btn-outline" onclick="exportCSV()">Export CSV</button>
    </div>
    <div class="table-wrap"><div class="table-header"><h3>All Servers</h3><a href="/admin" class="action-btn">← Back</a></div>
      <div style="overflow-x:auto;"><table class="data-table">
        <thead><tr><th>ID</th><th>Name</th><th>Owner</th><th>Node</th><th>Egg</th><th>Status</th><th>RAM</th><th>Disk</th><th>CPU</th><th>Power</th><th>Actions</th></tr></thead>
        <tbody>
          ${servers.map(s => `<tr>
            <td class="mono">${s.uuidShort||''}</td>
            <td><strong>${s.name}</strong>${s.suspended==1?' <span class="status-badge suspended">SUSP</span>':''}</td>
            <td><a href="/admin/users?search=${s.owner||''}" style="color:var(--dl-bronze-light);">${s.owner||'—'}</a></td>
            <td style="color:var(--dl-text-muted);">${s.node||'—'}</td>
            <td style="color:var(--dl-text-muted);">${s.egg||'—'}</td>
            <td><span class="status-badge ${s.status||'offline'}">${s.status||'offline'}</span></td>
            <td class="mono">${s.memory||0}M</td>
            <td class="mono">${s.disk||0}M</td>
            <td class="mono">${s.cpu||0}%</td>
            <td>
              <button class="power-btn start" onclick="power('${s.uuid}','start')">▶</button>
              <button class="power-btn stop" onclick="power('${s.uuid}','stop')">■</button>
              <button class="power-btn restart" onclick="power('${s.uuid}','restart')">↻</button>
            </td>
            <td>
              <a href="/server/${s.uuidShort}" class="action-btn">Console</a>
              <button class="action-btn danger" onclick="deleteServer(${s.id},'${s.name.replace(/'/g,"\\'")}')">Delete</button>
            </td>
          </tr>`).join('') || '<tr><td colspan="11" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No servers found</td></tr>'}
        </tbody>
      </table></div>
    </div>
  </div>
  <script>
    async function power(uuid,sig) {
      const r=await fetch('/api/admin-api?action=server_power',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({server_uuid:uuid,signal:sig})});
      const d=await r.json(); if(!d.success)alert(d.error||'Failed');
    }
    async function deleteServer(id,name) {
      if(!confirm('Delete server "'+name+'"?'))return;
      const r=await fetch('/api/admin-api?action=delete_server',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({server_id:id})});
      const d=await r.json(); if(d.success)location.reload();else alert(d.error);
    }
    function exportCSV() {
      const rows=[['ID','Name','Owner','Node','Status','RAM','Disk','CPU']];
      document.querySelectorAll('.data-table tbody tr').forEach(tr=>{
        const tds=tr.querySelectorAll('td'); rows.push([tds[0].textContent,tds[1].textContent,tds[2].textContent,tds[3].textContent,tds[5].textContent,tds[6].textContent,tds[7].textContent,tds[8].textContent]);
      });
      const csv=rows.map(r=>r.map(c=>'"'+c.replace(/"/g,'""')+'"').join(',')).join('\\n');
      const blob=new Blob([csv],{type:'text/csv'}); const a=document.createElement('a');
      a.href=URL.createObjectURL(blob); a.download='servers.csv'; a.click();
    }
  </script>
  </body></html>`);
}

function accessDenied(): string {
  return `<!DOCTYPE html><html><head><title>Access Denied</title><style>body{background:#080808;color:#e5e5e5;font-family:system-ui;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}.card{background:rgba(20,20,20,0.9);border:1px solid rgba(239,68,68,0.2);border-radius:16px;padding:2.5rem;text-align:center;}h1{color:#ef4444;}a{color:#e89060;text-decoration:none;}</style></head><body><div class="card"><h1>🛡️ Access Denied</h1><p>Admin access required.</p><a href="/">← Back to Panel</a></div></body></html>`;
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
