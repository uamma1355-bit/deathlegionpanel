import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin, sqlEscape } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send('Access Denied');

  const nodeFilter = (req.query.node as string) || '';
  let where = '';
  if (nodeFilter) where = ` WHERE a.node_id=${parseInt(nodeFilter)}`;

  const allocs = await mysqlQueryJson(`SELECT a.id, a.ip, a.port, a.alias, a.server_id, n.name as node, s.name as server FROM allocations a LEFT JOIN nodes n ON a.node_id = n.id LEFT JOIN servers s ON a.server_id = s.id${where} ORDER BY a.node_id, a.port LIMIT 500`);
  const nodes = await mysqlQueryJson('SELECT id, name FROM nodes ORDER BY id');

  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin — Allocations</title><style>${DESIGN_SYSTEM_CSS}
    .data-table{width:100%;border-collapse:collapse}.data-table th{text-align:left;padding:0.5rem 0.8rem;background:rgba(15,15,15,0.6);color:var(--dl-text-muted);font-size:0.65rem;text-transform:uppercase;border-bottom:1px solid var(--dl-border)}.data-table td{padding:0.5rem 0.8rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78rem}.data-table tr:hover td{background:rgba(188,110,60,0.04)}.data-table .mono{font-family:var(--dl-font-mono);font-size:0.72px}
    .table-wrap{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);overflow:hidden;backdrop-filter:blur(12px)}
    .table-wrap .table-header{padding:1rem 1.2rem;border-bottom:1px solid var(--dl-border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem}
    .filter-bar{display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap}
    .filter-bar select,.filter-bar input{padding:0.4rem 0.6rem;background:var(--dl-bg-input);border:1px solid var(--dl-border);border-radius:6px;color:var(--dl-text);font-size:0.8rem}
    .action-btn{padding:0.3rem 0.6rem;background:rgba(188,110,60,0.1);border:1px solid rgba(188,110,60,0.2);border-radius:5px;color:var(--dl-bronze-light);font-size:0.68rem;cursor:pointer;display:inline-block}
    .badge{padding:2px 6px;border-radius:5px;font-size:0.58rem;font-weight:700}.badge.free{background:rgba(34,197,94,0.15);color:var(--dl-green)}.badge.used{background:rgba(239,68,68,0.15);color:var(--dl-red)}
    .modal-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.8);display:none;align-items:center;justify-content:center;padding:1rem}.modal-overlay.active{display:flex}.modal{background:var(--dl-bg-elevated);border:1px solid rgba(188,110,60,0.3);border-radius:var(--dl-radius-xl);padding:2rem;max-width:400px;width:100%}
    .form-group{margin-bottom:0.8rem}.form-group label{display:block;color:var(--dl-text-muted);font-size:0.75rem;margin-bottom:0.2rem}.form-group input,.form-group select{width:100%;padding:0.5rem 0.7rem;background:var(--dl-bg-input);border:1px solid var(--dl-border);border-radius:var(--dl-radius);color:var(--dl-text);font-size:0.82rem}
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/allocations')}
  <div class="dl-container">
    <div class="dl-hero"><h1>Allocations (${allocs.length})</h1><p>Port allocations for all nodes.</p></div>
    <div class="table-wrap"><div class="table-header">
      <div class="filter-bar">
        <form method="GET" style="display:flex;gap:0.5rem;">
          <select name="node"><option value="">All Nodes</option>${nodes.map(n=>`<option value="${n.id}" ${nodeFilter==n.id?'selected':''}>${n.name}</option>`).join('')}</select>
          <button type="submit" class="action-btn">Filter</button>
        </form>
        <button class="dl-btn dl-btn-primary" onclick="document.getElementById('allocModal').classList.add('active')" style="margin-left:auto;">+ Add Ports</button>
      </div>
      <a href="/admin" class="action-btn">← Back</a>
    </div>
    <div style="overflow-x:auto;"><table class="data-table">
      <thead><tr><th>ID</th><th>Node</th><th>IP</th><th>Port</th><th>Alias</th><th>Status</th><th>Server</th><th>Actions</th></tr></thead>
      <tbody>
        ${allocs.map(a=>`<tr><td class="mono">${a.id}</td><td>${a.node||'—'}</td><td class="mono">${a.ip}</td><td class="mono">${a.port}</td><td>${a.alias||'—'}</td><td>${a.server_id?'<span class="badge used">USED</span>':'<span class="badge free">FREE</span>'}</td><td>${a.server||'—'}</td><td>${!a.server_id?`<button class="action-btn" onclick="deleteAlloc(${a.id})" style="color:var(--dl-red);">Delete</button>`:''}</td></tr>`).join('')||'<tr><td colspan="8" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No allocations</td></tr>'}
      </tbody>
    </table></div></div>
  </div>
  <div class="modal-overlay" id="allocModal"><div class="modal">
    <h2 style="font-family:var(--dl-font-display);color:var(--dl-bronze-light);margin-bottom:1rem;">Add Port Allocations</h2>
    <div class="form-group"><label>Node *</label><select id="a_node">${nodes.map(n=>`<option value="${n.id}">${n.name}</option>`).join('')}</select></div>
    <div class="form-group"><label>IP Address *</label><input type="text" id="a_ip" value="0.0.0.0" /></div>
    <div class="form-group"><label>Port Range Start *</label><input type="number" id="a_start" value="25565" /></div>
    <div class="form-group"><label>Port Range End (optional)</label><input type="number" id="a_end" placeholder="Same as start for single port" /></div>
    <div style="display:flex;gap:0.5rem;justify-content:flex-end;"><button class="dl-btn dl-btn-ghost" onclick="document.getElementById('allocModal').classList.remove('active')">Cancel</button><button class="dl-btn dl-btn-primary" onclick="addAlloc()">Add</button></div>
  </div></div>
  <script>
    async function addAlloc(){const body={action:'add_allocation',node_id:parseInt(a_node.value),ip:a_ip.value,ports_start:parseInt(a_start.value),ports_end:parseInt(a_end.value)||parseInt(a_start.value)};const r=await fetch('/api/admin-api?action=add_allocation',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)});const d=await r.json();if(d.success)location.reload();else alert(d.error);}
    async function deleteAlloc(id){if(!confirm('Delete allocation?'))return;const r=await fetch('/api/admin-api?action=delete_allocation',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({allocation_id:id})});const d=await r.json();if(d.success)location.reload();else alert(d.error);}
  </script></body></html>`);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
