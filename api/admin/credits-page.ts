import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin, sqlEscape } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send('Access Denied');

  const users = await mysqlQueryJson('SELECT id, username, email FROM users ORDER BY id DESC LIMIT 200');

  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin — Credits</title><style>${DESIGN_SYSTEM_CSS}
    .form-card{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);padding:1.5rem;margin-bottom:1rem;backdrop-filter:blur(12px)}
    .form-group{margin-bottom:0.8rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:end}
    .form-group select,.form-group input{padding:0.5rem 0.8rem;background:var(--dl-bg-input);border:1px solid var(--dl-border);border-radius:var(--dl-radius);color:var(--dl-text);font-size:0.82rem}
    .form-group label{display:block;color:var(--dl-text-muted);font-size:0.72rem;margin-bottom:0.2rem;text-transform:uppercase}
    .data-table{width:100%;border-collapse:collapse}.data-table th{text-align:left;padding:0.5rem 0.8rem;background:rgba(15,15,15,0.6);color:var(--dl-text-muted);font-size:0.65rem;text-transform:uppercase;border-bottom:1px solid var(--dl-border)}.data-table td{padding:0.5rem 0.8rem;border-bottom:1px solid rgba(255,255,255,0.04);font-size:0.78rem}
    .table-wrap{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);overflow:hidden;backdrop-filter:blur(12px)}
    .table-wrap .table-header{padding:1rem 1.2rem;border-bottom:1px solid var(--dl-border);display:flex;align-items:center;justify-content:space-between}
    .action-btn{padding:0.3rem 0.6rem;background:rgba(188,110,60,0.1);border:1px solid rgba(188,110,60,0.2);border-radius:5px;color:var(--dl-bronze-light);font-size:0.68rem;text-decoration:none;display:inline-block}
    .credit-display{font-family:var(--dl-font-mono);font-size:1.5rem;font-weight:700;color:var(--dl-bronze-light)}
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/credits')}
  <div class="dl-container">
    <div class="dl-hero"><h1>Credits Management</h1><p>View and adjust user credit balances.</p></div>
    <div class="form-card">
      <h3 style="font-family:var(--dl-font-display);color:var(--dl-bronze-light);font-size:0.9rem;margin-bottom:0.8rem;">Adjust Credits</h3>
      <div class="form-group">
        <div style="flex:1;"><label>User</label><select id="credit_user" style="width:100%;">${users.map(u=>`<option value="${u.username}">${u.username} (${u.email})</option>`).join('')}</select></div>
        <div><label>Amount</label><input type="number" id="credit_amount" value="50" style="width:100px;" /></div>
        <button class="dl-btn dl-btn-primary" onclick="adjustCredits()">Add Credits</button>
        <button class="dl-btn dl-btn-outline" onclick="checkBalance()">Check Balance</button>
      </div>
      <div id="balanceDisplay" style="margin-top:0.5rem;"></div>
    </div>
    <div class="table-wrap"><div class="table-header"><h3>Users</h3><a href="/admin" class="action-btn">← Back</a></div>
      <div style="overflow-x:auto;"><table class="data-table">
        <thead><tr><th>ID</th><th>Username</th><th>Email</th><th>Actions</th></tr></thead>
        <tbody>${users.map(u=>`<tr><td class="mono">${u.id}</td><td><strong>${u.username}</strong></td><td style="color:var(--dl-text-muted);">${u.email}</td><td><button class="action-btn" onclick="quickAdd('${u.username}',50)">+50</button><button class="action-btn" onclick="quickAdd('${u.username}',100)">+100</button><button class="action-btn" onclick="quickAdd('${u.username}',500)">+500</button></td></tr>`).join('')}</tbody>
      </table></div></div>
  </div>
  <script>
    async function adjustCredits(){const user=document.getElementById('credit_user').value;const amount=parseInt(document.getElementById('credit_amount').value);const r=await fetch('/api/admin-api?action=adjust_credits',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({username:user,amount})});const d=await r.json();if(d.success){alert('Added '+amount+' credits to '+user);checkBalance();}else alert(d.error);}
    async function quickAdd(user,amount){const r=await fetch('/api/admin-api?action=adjust_credits',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({username:user,amount})});const d=await r.json();if(d.success)alert('Added '+amount+' to '+user);else alert(d.error);}
    async function checkBalance(){const user=document.getElementById('credit_user').value;const r=await fetch('/api/credits?action=balance&user='+user);const d=await r.json();document.getElementById('balanceDisplay').innerHTML='<div class="credit-display">'+(d.credits===undefined?'?':d.credits)+' credits <span style="font-size:0.75rem;color:var(--dl-text-dim);">('+d.plan+')</span></div>';}
  </script></body></html>`);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
