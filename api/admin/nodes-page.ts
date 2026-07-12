import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin, sqlEscape } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send('Access Denied');

  const nodes = await mysqlQueryJson('SELECT n.*, l.short as location, COUNT(s.id) as server_count, COUNT(a.id) as alloc_total, SUM(CASE WHEN a.server_id IS NULL THEN 1 ELSE 0 END) as alloc_free FROM nodes n LEFT JOIN locations l ON n.location_id = l.id LEFT JOIN servers s ON s.node_id = n.id LEFT JOIN allocations a ON a.node_id = n.id GROUP BY n.id ORDER BY n.id');

  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin — Nodes</title><style>${DESIGN_SYSTEM_CSS}
    .data-table{width:100%;border-collapse:collapse}.data-table th{text-align:left;padding:0.6rem 0.9rem;background:rgba(15,15,15,0.6);color:var(--dl-text-muted);font-size:0.68rem;text-transform:uppercase;border-bottom:1px solid var(--dl-border)}.data-table td{padding:0.6rem 0.9rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.8rem}.data-table tr:hover td{background:rgba(188,110,60,0.04)}.data-table .mono{font-family:var(--dl-font-mono);font-size:0.72rem;color:var(--dl-text-muted)}
    .table-wrap{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);overflow:hidden;backdrop-filter:blur(12px);margin-bottom:1rem}
    .table-wrap .table-header{padding:1rem 1.2rem;border-bottom:1px solid var(--dl-border);display:flex;align-items:center;justify-content:space-between}
    .action-btn{padding:0.3rem 0.6rem;background:rgba(188,110,60,0.1);border:1px solid rgba(188,110,60,0.2);border-radius:5px;color:var(--dl-bronze-light);font-size:0.68rem;cursor:pointer;text-decoration:none;display:inline-block;margin-right:0.2rem}
    .action-btn.danger{color:var(--dl-red);border-color:rgba(239,68,68,0.2);background:rgba(239,68,68,0.05)}
    .modal-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.8);display:none;align-items:center;justify-content:center;padding:1rem}.modal-overlay.active{display:flex}.modal{background:var(--dl-bg-elevated);border:1px solid rgba(188,110,60,0.3);border-radius:var(--dl-radius-xl);padding:2rem;max-width:450px;width:100%}
    .form-group{margin-bottom:0.8rem}.form-group label{display:block;color:var(--dl-text-muted);font-size:0.75rem;margin-bottom:0.2rem}.form-group input{width:100%;padding:0.5rem 0.7rem;background:var(--dl-bg-input);border:1px solid var(--dl-border);border-radius:var(--dl-radius);color:var(--dl-text);font-size:0.82rem}
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/nodes')}
  <div class="dl-container">
    <div class="dl-hero"><h1>Nodes (${nodes.length})</h1><p>Manage compute nodes running Wings.</p></div>
    <div style="margin-bottom:1rem;"><button class="dl-btn dl-btn-primary" onclick="document.getElementById('nodeModal').classList.add('active')">+ Add Node</button></div>
    <div class="table-wrap"><div class="table-header"><h3>All Nodes</h3><a href="/admin" class="action-btn">← Back</a></div>
      <div style="overflow-x:auto;"><table class="data-table">
        <thead><tr><th>ID</th><th>Name</th><th>Location</th><th>FQDN</th><th>Port</th><th>Servers</th><th>Ports Free</th><th>Behind Proxy</th><th>Actions</th></tr></thead>
        <tbody>
          ${nodes.map(n=>`<tr><td class="mono">${n.id}</td><td><strong>${n.name}</strong></td><td>${n.location||'—'}</td><td class="mono">${n.fqdn||''}</td><td class="mono">${n.daemon_listen||''}</td><td>${n.server_count||0}</td><td>${n.alloc_free||0}/${n.alloc_total||0}</td><td>${n.behind_proxy==1?'✓':'—'}</td><td><a href="/admin/allocations?node=${n.id}" class="action-btn">Ports</a><button class="action-btn danger" onclick="deleteNode(${n.id},'${n.name.replace(/'/g,"\\'")}')">Delete</button></td></tr>`).join('')||'<tr><td colspan="9" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No nodes</td></tr>'}
        </tbody>
      </table></div>
    </div>
  </div>
  <div class="modal-overlay" id="nodeModal"><div class="modal">
    <h2 style="font-family:var(--dl-font-display);color:var(--dl-bronze-light);margin-bottom:1rem;">Add Node</h2>
    <div class="form-group"><label>Name *</label><input type="text" id="n_name" placeholder="Node 2" /></div>
    <div class="form-group"><label>FQDN *</label><input type="text" id="n_fqdn" placeholder="node2.example.com" /></div>
    <div class="form-group"><label>Daemon Listen Port</label><input type="number" id="n_port" value="8080" /></div>
    <div class="form-group"><label>SFTP Port</label><input type="number" id="n_sftp" value="2022" /></div>
    <div style="display:flex;gap:0.5rem;justify-content:flex-end;"><button class="dl-btn dl-btn-ghost" onclick="document.getElementById('nodeModal').classList.remove('active')">Cancel</button><button class="dl-btn dl-btn-primary" onclick="createNode()">Create</button></div>
  </div></div>
  <script>
    async function createNode(){
      const body={action:'create_node',name:n_name.value,fqdn:n_fqdn.value,daemon_listen:parseInt(n_port.value),daemon_sftp:parseInt(n_sftp.value)};
      const r=await fetch('/api/admin-api?action=create_node',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)});
      const d=await r.json(); if(d.success)location.reload();else alert(d.error);
    }
    async function deleteNode(id,name){if(!confirm('Delete node "'+name+'"?'))return;const r=await fetch('/api/admin-api?action=delete_node',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({node_id:id})});const d=await r.json();if(d.success)location.reload();else alert(d.error);}
  </script>
  </body></html>`);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
