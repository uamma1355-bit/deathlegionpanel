import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin, sqlEscape } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send('Access Denied');

  await mysqlQueryJson('CREATE TABLE IF NOT EXISTS dl_announcements (id INT PRIMARY KEY AUTO_INCREMENT, message TEXT, active TINYINT DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  const announcements = await mysqlQueryJson('SELECT * FROM dl_announcements ORDER BY id DESC LIMIT 20');

  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin — Announcements</title><style>${DESIGN_SYSTEM_CSS}
    .form-card{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);padding:1.5rem;margin-bottom:1rem;backdrop-filter:blur(12px)}
    .form-group{margin-bottom:0.8rem}.form-group label{display:block;color:var(--dl-text-muted);font-size:0.75rem;margin-bottom:0.2rem}.form-group textarea{width:100%;padding:0.6rem 0.8rem;background:var(--dl-bg-input);border:1px solid var(--dl-border);border-radius:var(--dl-radius);color:var(--dl-text);font-size:0.85rem;min-height:80px;resize:vertical}
    .data-table{width:100%;border-collapse:collapse}.data-table th{text-align:left;padding:0.5rem 0.8rem;background:rgba(15,15,15,0.6);color:var(--dl-text-muted);font-size:0.65rem;text-transform:uppercase;border-bottom:1px solid var(--dl-border)}.data-table td{padding:0.5rem 0.8rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78rem}
    .table-wrap{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);overflow:hidden;backdrop-filter:blur(12px)}
    .table-wrap .table-header{padding:1rem 1.2rem;border-bottom:1px solid var(--dl-border);display:flex;align-items:center;justify-content:space-between}
    .action-btn{padding:0.3rem 0.6rem;background:rgba(188,110,60,0.1);border:1px solid rgba(188,110,60,0.2);border-radius:5px;color:var(--dl-bronze-light);font-size:0.68px;cursor:pointer;display:inline-block}
    .badge{padding:2px 7px;border-radius:5px;font-size:0.58rem;font-weight:700}.badge.active{background:rgba(34,197,94,0.15);color:var(--dl-green)}.badge.inactive{background:rgba(100,100,100,0.15);color:#888}
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/announcements')}
  <div class="dl-container">
    <div class="dl-hero"><h1>Announcements</h1><p>Broadcast messages to all panel users.</p></div>
    <div class="form-card">
      <h3 style="font-family:var(--dl-font-display);color:var(--dl-bronze-light);font-size:0.9rem;margin-bottom:0.8rem;">New Announcement</h3>
      <div class="form-group"><label>Message</label><textarea id="ann_msg" placeholder="Scheduled maintenance at 3am UTC..."></textarea></div>
      <button class="dl-btn dl-btn-primary" onclick="createAnn()">Post Announcement</button>
      <button class="dl-btn dl-btn-outline" onclick="disableAll()" style="margin-left:0.5rem;">Disable All</button>
    </div>
    <div class="table-wrap"><div class="table-header"><h3>Recent Announcements</h3><a href="/admin" class="action-btn">← Back</a></div>
      <table class="data-table">
        <thead><tr><th>ID</th><th>Message</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead>
        <tbody>${announcements.map(a=>`<tr><td>${a.id}</td><td>${a.message}</td><td><span class="badge ${a.active==1?'active':'inactive'}">${a.active==1?'ACTIVE':'INACTIVE'}</span></td><td>${a.created_at}</td><td>${a.active==1?`<button class="action-btn" onclick="disableAnn(${a.id})">Disable</button>`:''}</td></tr>`).join('')||'<tr><td colspan="5" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No announcements</td></tr>'}</tbody>
      </table>
    </div>
  </div>
  <script>
    async function createAnn(){const msg=document.getElementById('ann_msg').value.trim();if(!msg)return;const r=await fetch('/api/admin-api?action=announcement',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({message:msg})});const d=await r.json();if(d.success)location.reload();else alert(d.error);}
    async function disableAll(){const r=await fetch('/api/admin-api?action=announcement',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({active:false})});const d=await r.json();if(d.success)location.reload();}
    async function disableAnn(id){const r=await fetch('/api/admin-api?action=announcement',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({active:false})});const d=await r.json();if(d.success)location.reload();}
  </script></body></html>`);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
