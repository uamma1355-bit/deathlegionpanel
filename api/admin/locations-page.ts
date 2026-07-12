import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin, sqlEscape } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send('Access Denied');

  const locations = await mysqlQueryJson('SELECT l.id, l.short, l.long, COUNT(n.id) as node_count, COUNT(s.id) as server_count FROM locations l LEFT JOIN nodes n ON n.location_id = l.id LEFT JOIN servers s ON s.location_id = l.id GROUP BY l.id ORDER BY l.id');

  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin — Locations</title><style>${DESIGN_SYSTEM_CSS}
    .data-table{width:100%;border-collapse:collapse}.data-table th{text-align:left;padding:0.6rem 0.9rem;background:rgba(15,15,15,0.6);color:var(--dl-text-muted);font-size:0.68rem;text-transform:uppercase;border-bottom:1px solid var(--dl-border)}.data-table td{padding:0.6rem 0.9rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.8rem}.data-table tr:hover td{background:rgba(188,110,60,0.04)}.data-table .mono{font-family:var(--dl-font-mono);font-size:0.72rem;color:var(--dl-text-muted)}
    .table-wrap{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);overflow:hidden;backdrop-filter:blur(12px)}
    .table-wrap .table-header{padding:1rem 1.2rem;border-bottom:1px solid var(--dl-border);display:flex;align-items:center;justify-content:space-between}
    .action-btn{padding:0.3rem 0.6rem;background:rgba(188,110,60,0.1);border:1px solid rgba(188,110,60,0.2);border-radius:5px;color:var(--dl-bronze-light);font-size:0.68rem;cursor:pointer;display:inline-block}
    .modal-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.8);display:none;align-items:center;justify-content:center;padding:1rem}.modal-overlay.active{display:flex}.modal{background:var(--dl-bg-elevated);border:1px solid rgba(188,110,60,0.3);border-radius:var(--dl-radius-xl);padding:2rem;max-width:400px;width:100%}
    .form-group{margin-bottom:0.8rem}.form-group label{display:block;color:var(--dl-text-muted);font-size:0.75rem;margin-bottom:0.2rem}.form-group input{width:100%;padding:0.5rem 0.7rem;background:var(--dl-bg-input);border:1px solid var(--dl-border);border-radius:var(--dl-radius);color:var(--dl-text);font-size:0.82rem}
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/locations')}
  <div class="dl-container">
    <div class="dl-hero"><h1>Locations (${locations.length})</h1><p>Geographic locations for nodes.</p></div>
    <div style="margin-bottom:1rem;"><button class="dl-btn dl-btn-primary" onclick="document.getElementById('locModal').classList.add('active')">+ Add Location</button></div>
    <div class="table-wrap"><div class="table-header"><h3>All Locations</h3><a href="/admin" class="action-btn">← Back</a></div>
      <div style="overflow-x:auto;"><table class="data-table">
        <thead><tr><th>ID</th><th>Short Code</th><th>Name</th><th>Nodes</th><th>Servers</th><th>Actions</th></tr></thead>
        <tbody>
          ${locations.map(l=>`<tr><td class="mono">${l.id}</td><td><strong>${l.short}</strong></td><td>${l.long}</td><td>${l.node_count||0}</td><td>${l.server_count||0}</td><td><button class="action-btn" onclick="deleteLoc(${l.id})" style="color:var(--dl-red);">Delete</button></td></tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No locations</td></tr>'}
        </tbody>
      </table></div></div>
  </div>
  <div class="modal-overlay" id="locModal"><div class="modal">
    <h2 style="font-family:var(--dl-font-display);color:var(--dl-bronze-light);margin-bottom:1rem;">Add Location</h2>
    <div class="form-group"><label>Short Code *</label><input type="text" id="l_short" placeholder="us-east" /></div>
    <div class="form-group"><label>Name *</label><input type="text" id="l_long" placeholder="US East Coast" /></div>
    <div style="display:flex;gap:0.5rem;justify-content:flex-end;"><button class="dl-btn dl-btn-ghost" onclick="document.getElementById('locModal').classList.remove('active')">Cancel</button><button class="dl-btn dl-btn-primary" onclick="createLoc()">Create</button></div>
  </div></div>
  <script>
    async function createLoc(){const r=await fetch('/api/admin-api?action=create_location',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({short:l_short.value,long:l_long.value})});const d=await r.json();if(d.success)location.reload();else alert(d.error||'Failed');}
    async function deleteLoc(id){if(!confirm('Delete location?'))return;const r=await fetch('/api/admin-api?action=delete_location',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({location_id:id})});const d=await r.json();if(d.success)location.reload();else alert(d.error);}
  </script></body></html>`);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
