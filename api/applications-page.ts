import type { VercelRequest, VercelResponse } from '@vercel/node';

const PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Death Legion — Admin Applications</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: #0a0a0a; color: #e5e5e5; min-height: 100vh; padding: 2rem; }
    .container { max-width: 900px; margin: 0 auto; }
    .logo { font-family: 'Cinzel', serif; font-size: 2rem; font-weight: 900; background: linear-gradient(135deg, #bc6e3c 0%, #e89060 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; text-align: center; margin-bottom: 0.3rem; letter-spacing: 0.08em; text-transform: uppercase; }
    .subtitle { text-align: center; color: #888; margin-bottom: 2rem; }
    .tabs { display: flex; gap: 0.5rem; margin-bottom: 2rem; justify-content: center; }
    .tab { padding: 0.6rem 1.5rem; background: rgba(20,20,20,0.8); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; cursor: pointer; font-size: 0.9rem; color: #888; transition: all 0.2s; }
    .tab.active { background: rgba(188,110,60,0.15); border-color: #bc6e3c; color: #e89060; }
    .tab:hover { border-color: rgba(188,110,60,0.3); }
    .card { background: rgba(20,20,20,0.8); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; }
    .app-row { display: flex; justify-content: space-between; align-items: center; padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.04); }
    .app-row:last-child { border-bottom: none; }
    .app-info { flex: 1; }
    .app-name { font-weight: 600; font-size: 1rem; color: #e89060; }
    .app-detail { color: #888; font-size: 0.85rem; margin-top: 0.2rem; }
    .app-date { color: #555; font-size: 0.8rem; margin-top: 0.3rem; }
    .app-actions { display: flex; gap: 0.5rem; }
    .btn { padding: 0.5rem 1.2rem; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem; transition: all 0.2s; }
    .btn-approve { background: #22c55e; color: #fff; }
    .btn-approve:hover { background: #16a34a; }
    .btn-reject { background: #ef4444; color: #fff; }
    .btn-reject:hover { background: #dc2626; }
    .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .status-badge { padding: 0.2rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .status-pending { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .status-approved { background: rgba(34,197,94,0.15); color: #22c55e; }
    .status-rejected { background: rgba(239,68,68,0.15); color: #ef4444; }
    .empty { text-align: center; padding: 3rem; color: #555; }
    .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .back-link { text-align: center; margin-top: 2rem; }
    .back-link a { color: #bc6e3c; text-decoration: none; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">Death Legion</div>
    <div class="subtitle">Admin — Application Approvals</div>
    <div class="tabs">
      <div class="tab active" onclick="loadApps('pending')">Pending</div>
      <div class="tab" onclick="loadApps('approved')">Approved</div>
      <div class="tab" onclick="loadApps('rejected')">Rejected</div>
    </div>
    <div id="appList"><div class="empty">Loading...</div></div>
    <div class="back-link"><a href="/">&larr; Back to Panel</a></div>
  </div>
  <script>
    async function loadApps(status) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      event && event.target.classList.add('active');
      document.getElementById('appList').innerHTML = '<div class="empty">Loading...</div>';

      try {
        const resp = await fetch('/api/admin-approve?status=' + status);
        const data = await resp.json();
        const apps = data.applications || [];

        if (apps.length === 0) {
          document.getElementById('appList').innerHTML = '<div class="empty">No ' + status + ' applications</div>';
          return;
        }

        let html = '<div class="card">';
        apps.forEach(app => {
          const date = new Date(app.created_at).toLocaleString();
          html += '<div class="app-row">';
          html += '<div class="app-info">';
          html += '<div class="app-name">' + app.first_name + ' ' + app.last_name + ' (@' + app.username + ')</div>';
          html += '<div class="app-detail">' + app.email + '</div>';
          html += '<div class="app-date">Applied: ' + date + '</div>';
          html += '</div>';
          html += '<div class="app-actions">';
          if (app.status === 'pending') {
            html += '<button class="btn btn-approve" onclick="approve(' + app.id + ', this)">Approve</button>';
            html += '<button class="btn btn-reject" onclick="reject(' + app.id + ', this)">Reject</button>';
          } else {
            html += '<span class="status-badge status-' + app.status + '">' + app.status + '</span>';
          }
          html += '</div>';
          html += '</div>';
        });
        html += '</div>';
        document.getElementById('appList').innerHTML = html;
      } catch (e) {
        document.getElementById('appList').innerHTML = '<div class="empty">Error: ' + e.message + '</div>';
      }
    }

    async function approve(id, btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span>';
      try {
        const resp = await fetch('/api/admin-approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'approve', application_id: id })
        });
        const data = await resp.json();
        if (data.success) {
          alert('Approved! User created with ' + data.servers_created + ' servers.');
          loadApps('pending');
        } else {
          alert('Error: ' + (data.error || 'Unknown'));
          btn.disabled = false;
          btn.innerHTML = 'Approve';
        }
      } catch (e) {
        alert('Error: ' + e.message);
        btn.disabled = false;
        btn.innerHTML = 'Approve';
      }
    }

    async function reject(id, btn) {
      btn.disabled = true;
      try {
        const resp = await fetch('/api/admin-approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'reject', application_id: id })
        });
        const data = await resp.json();
        if (data.success) {
          loadApps('pending');
        }
      } catch (e) {
        btn.disabled = false;
      }
    }

    loadApps('pending');
  </script>
</body>
</html>`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  return res.status(200).send(PAGE_HTML);
}
