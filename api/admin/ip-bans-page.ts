import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin, sqlEscape } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send('Access Denied');

  await mysqlQueryJson('CREATE TABLE IF NOT EXISTS dl_ip_bans (id INT PRIMARY KEY AUTO_INCREMENT, ip VARCHAR(45) UNIQUE, reason TEXT, banned_by INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)');
  const bans = await mysqlQueryJson('SELECT b.*, u.username as banned_by_name FROM dl_ip_bans b LEFT JOIN users u ON b.banned_by = u.id ORDER BY b.id DESC');

  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin — IP Bans</title><style>${DESIGN_SYSTEM_CSS}
    .form-card{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);padding:1.5rem;margin-bottom:1rem;backdrop-filter:blur(12px)}
    .form-group{margin-bottom:0.8rem;display:flex;gap:0.5rem;flex-wrap:wrap}
    .form-group input{flex:1;padding:0.5rem 0.8rem;background:var(--dl-bg-input);border:1px solid var(--dl-border);border-radius:var(--dl-radius);color:var(--dl-text);font-size:0.82rem}
    .data-table{width:100%;border-collapse:collapse}.data-table th{text-align:left;padding:0.5rem 0.8rem;background:rgba(15,15,15,0.6);color:var(--dl-text-muted);font-size:0.65rem;text-transform:uppercase;border-bottom:1px solid var(--dl-border)}.data-table td{padding:0.5rem 0.8rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78rem}
    .table-wrap{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);overflow:hidden;backdrop-filter:blur(12px)}
    .table-wrap .table-header{padding:1rem 1.2rem;border-bottom:1px solid var(--dl-border);display:flex;align-items:center;justify-content:space-between}
    .action-btn{padding:0.3rem 0.6rem;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);border-radius:5px;color:var(--dl-red);font-size:0.68rem;cursor:pointer;display:inline-block}
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/ip-bans')}
  <div class="dl-container">
    <div class="dl-hero"><h1>IP Bans (${bans.length})</h1><p>Block malicious IP addresses.</p></div>
    <div class="form-card">
      <h3 style="font-family:var(--dl-font-display);color:var(--dl-bronze-light);font-size:0.9rem;margin-bottom:0.8rem;">Add IP Ban</h3>
      <div class="form-group">
        <input type="text" id="ban_ip" placeholder="IP address (e.g. 1.2.3.4)" />
        <input type="text" id="ban_reason" placeholder="Reason (optional)" style="flex:2;" />
        <button class="dl-btn dl-btn-danger" onclick="banIp()">Ban IP</button>
      </div>
    </div>
    <div class="table-wrap"><div class="table-header"><h3>Banned IPs</h3><a href="/admin" class="action-btn" style="background:rgba(188,110,60,0.1);color:var(--dl-bronze-light);">← Back</a></div>
      <table class="data-table">
        <thead><tr><th>ID</th><th>IP</th><th>Reason</th><th>Banned By</th><th>Date</th><th>Actions</th></tr></thead>
        <tbody>${bans.map(b=>`<tr><td>${b.id}</td><td class="mono" style="font-family:var(--dl-font-mono);color:var(--dl-red);">${b.ip}</td><td>${b.reason||'—'}</td><td>${b.banned_by_name||'admin'}</td><td class="mono" style="font-family:var(--dl-font-mono);font-size:0.72rem;color:var(--dl-text-muted);">${b.created_at}</td><td><button class="action-btn" onclick="unban('${b.ip}')">Unban</button></td></tr>`).join('')||'<tr><td colspan="6" style="text-align:center;color:var(--dl-text-dim);padding:2rem;">No banned IPs</td></tr>'}</tbody>
      </table>
    </div>
  </div>
  <script>
    async function banIp(){const ip=document.getElementById('ban_ip').value.trim();if(!ip)return;const reason=document.getElementById('ban_reason').value.trim();const r=await fetch('/api/admin-api?action=ban_ip',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({ip,reason})});const d=await r.json();if(d.success)location.reload();else alert(d.error);}
    async function unban(ip){const r=await fetch('/api/admin-api?action=unban_ip',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({ip})});const d=await r.json();if(d.success)location.reload();else alert(d.error);}
  </script></body></html>`);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
