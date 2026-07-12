import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';
import { mysqlQueryJson, verifyAdmin } from '../_admin';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const admin = await verifyAdmin(req);
  if (!admin) return res.status(403).send('Access Denied');

  const settings = await mysqlQueryJson('SELECT * FROM settings');
  const settingsMap: any = {};
  settings.forEach(s => { settingsMap[s.key] = s.value; });

  res.status(200).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin — Settings</title><style>${DESIGN_SYSTEM_CSS}
    .form-card{background:var(--dl-bg-card);border:1px solid var(--dl-border);border-radius:var(--dl-radius-lg);padding:1.5rem;margin-bottom:1rem;backdrop-filter:blur(12px)}
    .form-card h3{font-family:var(--dl-font-display);color:var(--dl-bronze-light);font-size:0.9rem;margin-bottom:0.8rem;letter-spacing:0.05em;text-transform:uppercase}
    .form-group{margin-bottom:0.8rem}.form-group label{display:block;color:var(--dl-text-muted);font-size:0.75rem;margin-bottom:0.2rem}.form-group input,.form-group select,.form-group textarea{width:100%;padding:0.5rem 0.7rem;background:var(--dl-bg-input);border:1px solid var(--dl-border);border-radius:var(--dl-radius);color:var(--dl-text);font-size:0.82rem}
    .checkbox-group{display:flex;align-items:center;gap:0.4rem}.checkbox-group input{width:auto}
    .action-btn{padding:0.3rem 0.6rem;background:rgba(188,110,60,0.1);border:1px solid rgba(188,110,60,0.2);border-radius:5px;color:var(--dl-bronze-light);font-size:0.68rem;text-decoration:none;display:inline-block}
  </style></head><body class="dl-bg">
  ${sharedHeader('/admin/settings')}
  <div class="dl-container">
    <div class="dl-hero"><h1>System Settings</h1><p>Configure panel-wide settings.</p></div>

    <div class="form-card">
      <h3>Panel Settings</h3>
      <div class="form-group"><label>Panel Name</label><input type="text" id="app_name" value="${settingsMap['app_name'] || 'Death Legion Panel'}" /></div>
      <div class="form-group"><label>Support Email</label><input type="email" id="support_email" value="${settingsMap['support_email'] || 'support@deathlegion.dev'}" /></div>
      <div class="form-group"><label>Default Language</label><select id="default_language"><option value="en" selected>English</option><option value="es">Spanish</option><option value="de">German</option></select></div>
      <button class="dl-btn dl-btn-primary" onclick="saveSettings()">Save Settings</button>
    </div>

    <div class="form-card">
      <h3>Maintenance Mode</h3>
      <p style="color:var(--dl-text-muted);font-size:0.82rem;margin-bottom:0.8rem;">When enabled, only admins can access the panel. Users see a maintenance message.</p>
      <div class="checkbox-group"><input type="checkbox" id="maintenance_mode" ${settingsMap['maintenance_mode'] == 'true' ? 'checked' : ''} /><label for="maintenance_mode" style="margin:0;">Enable maintenance mode</label></div>
      <button class="dl-btn dl-btn-danger" style="margin-top:0.5rem;" onclick="toggleMaintenance()">Apply</button>
    </div>

    <div class="form-card">
      <h3>Email Configuration</h3>
      <div class="form-group"><label>SMTP Host</label><input type="text" id="smtp_host" value="${settingsMap['smtp_host'] || ''}" placeholder="smtp.gmail.com" /></div>
      <div class="form-group"><label>SMTP Port</label><input type="number" id="smtp_port" value="${settingsMap['smtp_port'] || '587'}" /></div>
      <div class="form-group"><label>SMTP Username</label><input type="text" id="smtp_user" value="${settingsMap['smtp_user'] || ''}" /></div>
      <div class="form-group"><label>SMTP Password</label><input type="password" id="smtp_pass" value="${settingsMap['smtp_pass'] || ''}" /></div>
      <button class="dl-btn dl-btn-primary" onclick="saveSMTP()">Save SMTP</button>
    </div>

    <div class="form-card">
      <h3>Cache Management</h3>
      <p style="color:var(--dl-text-muted);font-size:0.82rem;margin-bottom:0.8rem;">Clear panel caches if you're experiencing stale data.</p>
      <button class="dl-btn dl-btn-outline" onclick="clearCache('config')">Clear Config Cache</button>
      <button class="dl-btn dl-btn-outline" onclick="clearCache('route')" style="margin-left:0.5rem;">Clear Route Cache</button>
      <button class="dl-btn dl-btn-outline" onclick="clearCache('view')" style="margin-left:0.5rem;">Clear View Cache</button>
    </div>

    <div style="margin-top:1rem;"><a href="/admin" class="action-btn">← Back to Admin</a></div>
  </div>
  <script>
    async function saveSettings(){
      const body={action:'save_settings',app_name:app_name.value,support_email:support_email.value,default_language:default_language.value};
      const r=await fetch('/api/admin-api?action=save_settings',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)});
      const d=await r.json(); if(d.success)alert('Settings saved');else alert(d.error);
    }
    async function toggleMaintenance(){
      const body={action:'save_settings',maintenance_mode:document.getElementById('maintenance_mode').checked?'true':'false'};
      const r=await fetch('/api/admin-api?action=save_settings',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)});
      const d=await r.json(); if(d.success)alert('Maintenance mode updated');else alert(d.error);
    }
    async function saveSMTP(){
      const body={action:'save_settings',smtp_host:smtp_host.value,smtp_port:smtp_port.value,smtp_user:smtp_user.value,smtp_pass:smtp_pass.value};
      const r=await fetch('/api/admin-api?action=save_settings',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify(body)});
      const d=await r.json(); if(d.success)alert('SMTP saved');else alert(d.error);
    }
    async function clearCache(type){
      const r=await fetch('/api/admin-api?action=clear_cache',{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({cache_type:type})});
      const d=await r.json(); if(d.success)alert(type+' cache cleared');else alert(d.error);
    }
  </script></body></html>`);
}

export const config = { api: { bodyParser: false }, maxDuration: 60 };
