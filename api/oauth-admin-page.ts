import type { VercelRequest, VercelResponse } from '@vercel/node';
import { DESIGN_SYSTEM_CSS, sharedHeader } from '../_design';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Death Legion — OAuth Apps</title>
  <style>${DESIGN_SYSTEM_CSS}
    .app-card { background:var(--dl-bg-card); backdrop-filter:blur(12px); border:1px solid var(--dl-border); border-radius:var(--dl-radius-lg); padding:1.5rem; margin-bottom:1rem; transition:var(--dl-transition); position:relative; }
    .app-card:hover { border-color:var(--dl-border-hover); }
    .app-card.inactive { opacity:0.5; }
    .app-header { display:flex; justify-content:space-between; align-items:start; margin-bottom:1rem; gap:1rem; }
    .app-info h3 { font-family:var(--dl-font-display); color:var(--dl-bronze-light); font-size:1.1rem; margin-bottom:0.2rem; }
    .app-info .app-desc { color:var(--dl-text-muted); font-size:0.82rem; margin-bottom:0.3rem; }
    .app-info .app-home { color:var(--dl-text-dim); font-size:0.78rem; }
    .app-credentials { background:rgba(0,0,0,0.3); border:1px solid var(--dl-border); border-radius:var(--dl-radius); padding:0.8rem; margin-bottom:0.8rem; }
    .credential-row { display:flex; align-items:center; gap:0.5rem; margin-bottom:0.4rem; }
    .credential-row:last-child { margin-bottom:0; }
    .credential-label { color:var(--dl-text-dim); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.08em; min-width:90px; }
    .credential-value { font-family:var(--dl-font-mono); font-size:0.78rem; color:var(--dl-text); flex:1; word-break:break-all; background:rgba(0,0,0,0.3); padding:0.2rem 0.5rem; border-radius:4px; }
    .copy-btn { padding:0.2rem 0.6rem; background:rgba(188,110,60,0.1); border:1px solid rgba(188,110,60,0.2); border-radius:4px; color:var(--dl-bronze-light); font-size:0.68rem; cursor:pointer; transition:var(--dl-transition); white-space:nowrap; }
    .copy-btn:hover { background:rgba(188,110,60,0.2); }
    .redirect-uris { margin-bottom:0.8rem; }
    .redirect-uris-label { color:var(--dl-text-dim); font-size:0.72rem; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:0.3rem; }
    .redirect-uri { font-family:var(--dl-font-mono); font-size:0.75rem; color:var(--dl-text-muted); background:rgba(0,0,0,0.3); padding:0.2rem 0.5rem; border-radius:4px; margin-bottom:0.2rem; word-break:break-all; }
    .app-actions { display:flex; gap:0.4rem; flex-wrap:wrap; }
    .modal-overlay { position:fixed; inset:0; z-index:10000; background:rgba(0,0,0,0.8); backdrop-filter:blur(8px); display:none; align-items:center; justify-content:center; padding:1rem; }
    .modal-overlay.active { display:flex; }
    .modal { background:var(--dl-bg-elevated); border:1px solid rgba(188,110,60,0.3); border-radius:var(--dl-radius-xl); padding:2rem; max-width:500px; width:100%; box-shadow:var(--dl-shadow-lg); max-height:90vh; overflow-y:auto; }
    .modal h2 { font-family:var(--dl-font-display); color:var(--dl-bronze-light); font-size:1.3rem; margin-bottom:1rem; letter-spacing:0.05em; }
    .form-group { margin-bottom:1rem; }
    .form-group label { display:block; color:var(--dl-text-muted); font-size:0.78rem; margin-bottom:0.3rem; text-transform:uppercase; letter-spacing:0.05em; }
    .form-group input, .form-group textarea { width:100%; padding:0.6rem 0.8rem; background:var(--dl-bg-input); border:1px solid var(--dl-border); border-radius:var(--dl-radius); color:var(--dl-text); font-size:0.85rem; font-family:var(--dl-font-body); transition:var(--dl-transition); }
    .form-group input:focus, .form-group textarea:focus { outline:none; border-color:rgba(188,110,60,0.5); box-shadow:0 0 0 3px rgba(188,110,60,0.1); }
    .form-group textarea { min-height:80px; resize:vertical; font-family:var(--dl-font-mono); font-size:0.78rem; }
    .form-group .hint { color:var(--dl-text-dim); font-size:0.7rem; margin-top:0.2rem; }
    .modal-actions { display:flex; gap:0.5rem; justify-content:flex-end; margin-top:1.5rem; }
    .loading { text-align:center; padding:3rem; color:var(--dl-text-muted); }
  </style>
</head>
<body class="dl-bg">
  ${sharedHeader('/oauth')}
  <div class="dl-container">
    <div class="dl-hero">
      <h1>OAuth Applications</h1>
      <p>Register apps that can use Death Legion as an identity provider via OAuth 2.0.</p>
      <div style="margin-top:1rem;">
        <button class="dl-btn dl-btn-primary" onclick="openCreateModal()">+ New OAuth App</button>
      </div>
    </div>

    <h2 class="dl-section-title">Registered Apps</h2>
    <div id="appsList">
      <div class="loading"><span class="dl-spinner"></span> Loading apps...</div>
    </div>

    <div class="dl-empty" id="emptyState" style="display:none;">
      <div class="dl-empty-icon">🔌</div>
      <h3>No OAuth apps yet</h3>
      <p>Create your first OAuth app to let users "Connect with Death Legion".</p>
    </div>

    <div class="dl-footer">
      <p>OAuth 2.0 Authorization Code grant with refresh tokens · <a href="/">Back to Panel</a></p>
    </div>
  </div>

  <!-- Create/Edit Modal -->
  <div class="modal-overlay" id="appModal">
    <div class="modal">
      <h2 id="modalTitle">New OAuth App</h2>
      <input type="hidden" id="appId" />
      <div class="form-group">
        <label>App Name *</label>
        <input type="text" id="appName" placeholder="My Legion App" />
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea id="appDesc" placeholder="What your app does"></textarea>
      </div>
      <div class="form-group">
        <label>Homepage URL</label>
        <input type="url" id="appHome" placeholder="https://myapp.com" />
      </div>
      <div class="form-group">
        <label>Redirect URIs * <span style="color:var(--dl-text-dim)">(one per line)</span></label>
        <textarea id="appRedirects" placeholder="https://myapp.com/auth/callback"></textarea>
        <div class="hint">HTTPS required in production. http://localhost allowed for dev.</div>
      </div>
      <div class="modal-actions">
        <button class="dl-btn dl-btn-ghost" onclick="closeModal()">Cancel</button>
        <button class="dl-btn dl-btn-primary" onclick="saveApp()">Save App</button>
      </div>
    </div>
  </div>

  <script>
    let apps = [];

    async function loadApps() {
      try {
        const res = await fetch('/api/oauth/apps', { credentials:'include', headers:{'Accept':'application/json'} });
        if (!res.ok) {
          document.getElementById('appsList').innerHTML = '<div class="loading" style="color:var(--dl-red);">Failed to load: ' + res.status + (res.status === 403 ? ' (admin access required)' : '') + '</div>';
          return;
        }
        const data = await res.json();
        apps = data.apps || [];
        renderApps();
      } catch(e) {
        document.getElementById('appsList').innerHTML = '<div class="loading" style="color:var(--dl-red);">Error: ' + e.message + '</div>';
      }
    }

    function renderApps() {
      const list = document.getElementById('appsList');
      const empty = document.getElementById('emptyState');
      if (apps.length === 0) {
        list.innerHTML = '';
        empty.style.display = 'block';
        return;
      }
      empty.style.display = 'none';
      list.innerHTML = apps.map(app => {
        const redirects = app.redirect_uris.map(u => '<div class="redirect-uri">' + escapeHtml(u) + '</div>').join('');
        return '<div class="app-card dl-fade-in' + (!app.active ? ' inactive' : '') + '">' +
          '<div class="app-header">' +
            '<div class="app-info">' +
              '<h3>' + escapeHtml(app.name) + ' ' + (!app.active ? '<span class="dl-pill dl-pill-red">INACTIVE</span>' : '') + '</h3>' +
              (app.description ? '<div class="app-desc">' + escapeHtml(app.description) + '</div>' : '') +
              (app.homepage_url ? '<div class="app-home"><a href="' + escapeHtml(app.homepage_url) + '" target="_blank" rel="noopener" style="color:var(--dl-bronze);">' + escapeHtml(app.homepage_url) + '</a></div>' : '') +
            '</div>' +
            '<div class="app-actions">' +
              '<button class="dl-btn dl-btn-outline" onclick="editApp(' + app.id + ')">Edit</button>' +
              '<button class="dl-btn dl-btn-ghost" onclick="toggleActive(' + app.id + ', ' + app.active + ')">' + (app.active ? 'Disable' : 'Enable') + '</button>' +
              '<button class="dl-btn dl-btn-ghost" onclick="rotateSecret(' + app.id + ')" style="color:var(--dl-yellow);border-color:rgba(234,179,8,0.2)">Rotate Secret</button>' +
              '<button class="dl-btn dl-btn-danger" onclick="deleteApp(' + app.id + ')">Delete</button>' +
            '</div>' +
          '</div>' +
          '<div class="app-credentials">' +
            '<div class="credential-row"><span class="credential-label">Client ID</span><span class="credential-value">' + app.client_id + '</span><button class="copy-btn" data-copy="' + app.client_id + '">Copy</button></div>' +
            '<div class="credential-row"><span class="credential-label">Client Secret</span><span class="credential-value" id="secret-' + app.id + '">••••••••••••••••••••</span><button class="copy-btn" data-reveal="' + app.id + '">Reveal</button></div>' +
          '</div>' +
          '<div class="redirect-uris">' +
            '<div class="redirect-uris-label">Redirect URIs</div>' +
            redirects +
          '</div>' +
        '</div>';
      }).join('');
      // Attach event listeners for copy/reveal buttons
      document.querySelectorAll('[data-copy]').forEach(function(btn) {
        btn.onclick = function() { copyText(btn.getAttribute('data-copy'), btn); };
      });
      document.querySelectorAll('[data-reveal]').forEach(function(btn) {
        btn.onclick = function() { revealSecret(parseInt(btn.getAttribute('data-reveal')), btn); };
      });
    }

    function escapeHtml(s) {
      return String(s||'').replace(/[&<>"']/g, function(c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
      });
    }

    function copyText(text, btn) {
      navigator.clipboard.writeText(text).then(() => {
        btn.textContent = '✓';
        setTimeout(() => btn.textContent = 'Copy', 1500);
      });
    }

    async function revealSecret(id, btn) {
      try {
        const res = await fetch('/api/oauth/apps', { credentials:'include', headers:{'Accept':'application/json'} });
        const data = await res.json();
        const app = (data.apps || []).find(a => a.id === id);
        if (app) {
          document.getElementById('secret-' + id).textContent = app.client_secret;
          btn.textContent = 'Copy';
          btn.onclick = function() { copyText(app.client_secret, this); };
        }
      } catch(e) {}
    }

    function openCreateModal() {
      document.getElementById('modalTitle').textContent = 'New OAuth App';
      document.getElementById('appId').value = '';
      document.getElementById('appName').value = '';
      document.getElementById('appDesc').value = '';
      document.getElementById('appHome').value = '';
      document.getElementById('appRedirects').value = '';
      document.getElementById('appModal').classList.add('active');
    }

    function editApp(id) {
      const app = apps.find(a => a.id === id);
      if (!app) return;
      document.getElementById('modalTitle').textContent = 'Edit: ' + app.name;
      document.getElementById('appId').value = app.id;
      document.getElementById('appName').value = app.name;
      document.getElementById('appDesc').value = app.description || '';
      document.getElementById('appHome').value = app.homepage_url || '';
      document.getElementById('appRedirects').value = app.redirect_uris.join('\\\n');
      document.getElementById('appModal').classList.add('active');
    }

    function closeModal() {
      document.getElementById('appModal').classList.remove('active');
    }

    async function saveApp() {
      const id = document.getElementById('appId').value;
      const name = document.getElementById('appName').value.trim();
      const description = document.getElementById('appDesc').value.trim();
      const homepageUrl = document.getElementById('appHome').value.trim();
      const redirectUris = document.getElementById('appRedirects').value.split('\\\n').map(s => s.trim()).filter(Boolean);

      if (!name) { alert('App name required'); return; }
      if (redirectUris.length === 0) { alert('At least one redirect URI required'); return; }

      try {
        if (id) {
          // Update
          const res = await fetch('/api/oauth/apps/' + id, {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ name, description, homepageUrl, redirectUris })
          });
          if (!res.ok) { const e = await res.json(); alert('Error: ' + (e.error_description || e.error)); return; }
        } else {
          // Create
          const res = await fetch('/api/oauth/apps', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
            body: JSON.stringify({ name, description, homepageUrl, redirectUris })
          });
          if (!res.ok) { const e = await res.json(); alert('Error: ' + (e.error_description || e.error)); return; }
        }
        closeModal();
        loadApps();
      } catch(e) { alert('Error: ' + e.message); }
    }

    async function toggleActive(id, currentActive) {
      try {
        const res = await fetch('/api/oauth/apps/' + id, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ active: !currentActive })
        });
        if (res.ok) loadApps();
      } catch(e) {}
    }

    async function rotateSecret(id) {
      if (!confirm('Rotate client secret? The old secret will stop working immediately.')) return;
      try {
        const res = await fetch('/api/oauth/apps/' + id, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
          body: JSON.stringify({ rotateSecret: true })
        });
        if (res.ok) {
          loadApps();
          alert('Secret rotated. Copy the new secret from the app card.');
        }
      } catch(e) {}
    }

    async function deleteApp(id) {
      const app = apps.find(a => a.id === id);
      if (!confirm('Delete "' + (app?.name || 'app') + '"? All tokens will be revoked immediately.')) return;
      try {
        const res = await fetch('/api/oauth/apps/' + id, {
          method: 'DELETE', credentials: 'include'
        });
        if (res.ok) loadApps();
      } catch(e) {}
    }

    loadApps();
  </script>
</body>
</html>`;

  return res.status(200).send(html);
}
