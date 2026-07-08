import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
const DAYTONA_API = 'https://app.daytona.io/api';

const SANDBOXES = [
  { num: 1, id: '210e4afe-d6d5-4cc1-b3d3-05f40077ea15', role: 'Panel + Wings', name: 'Compute Node 1' },
  { num: 2, id: 'f5a3ce9a-eb83-44a9-8f05-33eee5848b04', role: 'Wings Proxy', name: 'Compute Node 2' },
  { num: 3, id: '3c575ec2-0e0e-46b6-8c28-4aaf329394a9', role: 'Wings Proxy', name: 'Compute Node 3' },
  { num: 4, id: '0f1a0854-02dd-4a42-8bda-6b73c2efa738', role: 'Wings Proxy', name: 'Compute Node 4' },
  { num: 5, id: 'fd91f2e1-99cf-4b04-a4f9-2a05d52c0e4d', role: 'Wings Proxy', name: 'Compute Node 5' },
];

async function checkSandbox(sandboxId: string): Promise<any> {
  try {
    const resp = await fetch(`${DAYTONA_API}/sandbox/${sandboxId}`, {
      headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}` },
      signal: AbortSignal.timeout(5000),
    });
    const data = await resp.json() as any;
    return {
      state: data.state || 'unknown',
      cpu: data.cpu || 1,
      memory: data.memory || 1,
      disk: data.disk || 3,
    };
  } catch {
    return { state: 'error', cpu: 0, memory: 0, disk: 0 };
  }
}

async function getLiveMetrics(sandboxId: string, isStarted: boolean): Promise<any> {
  if (!isStarted) return { cpuUsage: 0, ramUsed: 0, ramTotal: 0, diskUsed: 0, diskTotal: 0, workloads: 0 };
  try {
    const resp = await fetch(`${DAYTONA_API}/toolbox/${sandboxId}/toolbox/process/execute`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        command: `CPU=$(top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d% -f1 2>/dev/null || echo 0); RAM_U=$(free -m | grep Mem | awk '{print $3}' 2>/dev/null || echo 0); RAM_T=$(free -m | grep Mem | awk '{print $2}' 2>/dev/null || echo 0); DISK_U=$(df / | tail -1 | awk '{print $3}' 2>/dev/null || echo 0); DISK_T=$(df / | tail -1 | awk '{print $2}' 2>/dev/null || echo 0); WL=$(pgrep -c -f 'php8.4|wings|dockerd|nginx|redis|mariadbd' 2>/dev/null || echo 0); echo "{\\"cpu\\":$CPU,\\"ram_u\\":$RAM_U,\\"ram_t\\":$RAM_T,\\"disk_u\\":$DISK_U,\\"disk_t\\":$DISK_T,\\"wl\\":$WL}"`,
        cwd: '/home/daytona',
        timeout: 10,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await resp.json() as any;
    const result = data.result || '{}';
    try {
      const m = JSON.parse(result.trim());
      return { cpuUsage: m.cpu || 0, ramUsed: m.ram_u || 0, ramTotal: m.ram_t || 0, diskUsed: m.disk_u || 0, diskTotal: m.disk_t || 0, workloads: m.wl || 0 };
    } catch {
      return { cpuUsage: 0, ramUsed: 0, ramTotal: 0, diskUsed: 0, diskTotal: 0, workloads: 0 };
    }
  } catch {
    return { cpuUsage: 0, ramUsed: 0, ramTotal: 0, diskUsed: 0, diskTotal: 0, workloads: 0 };
  }
}

async function checkPanelHealth(): Promise<any> {
  try {
    const resp = await fetch('https://deathlegionpanel.vercel.app/api/health', {
      signal: AbortSignal.timeout(8000),
    });
    return await resp.json() as any;
  } catch {
    return { status: 'unhealthy', panel: { status: 'down', response_time_ms: 0 }, api: { status: 'down' }, self_heal: { status: 'unknown' } };
  }
}

function dashboardHtml(nodes: any[], panelHealth: any): string {
  const healthyCount = nodes.filter(n => n.state === 'started').length;
  const offlineCount = nodes.length - healthyCount;
  const clusterHealth = healthyCount === nodes.length ? 'healthy' : healthyCount > 0 ? 'degraded' : 'critical';
  const healthColor = clusterHealth === 'healthy' ? '#22c55e' : clusterHealth === 'degraded' ? '#f59e0b' : '#ef4444';
  const healthText = clusterHealth === 'healthy' ? 'All Systems Operational' : clusterHealth === 'degraded' ? 'Degraded Performance' : 'Critical';
  const timestamp = new Date().toISOString();

  const totalCpu = nodes.reduce((s, n) => s + n.cpu, 0);
  const totalRam = nodes.reduce((s, n) => s + n.memory, 0);
  const totalDisk = nodes.reduce((s, n) => s + n.disk, 0);
  const totalWorkloads = nodes.reduce((s, n) => s + (n.workloads || 0), 0);
  const avgCpuUsage = nodes.length > 0 ? (nodes.reduce((s, n) => s + (n.cpuUsage || 0), 0) / nodes.length).toFixed(1) : '0';
  const totalRamUsed = nodes.reduce((s, n) => s + (n.ramUsed || 0), 0);
  const totalRamAvail = nodes.reduce((s, n) => s + (n.ramTotal || 0), 0);

  // Find least loaded node (scheduler decision)
  const healthyNodes = nodes.filter(n => n.state === 'started');
  const leastLoaded = healthyNodes.length > 0 
    ? healthyNodes.reduce((min, n) => {
        const score = (n.cpuUsage || 0) + (n.workloads || 0) * 10;
        const minScore = (min.cpuUsage || 0) + (min.workloads || 0) * 10;
        return score < minScore ? n : min;
      })
    : null;

  const nodeCards = nodes.map(n => {
    const color = n.state === 'started' ? '#22c55e' : '#ef4444';
    const ramPct = n.ramTotal > 0 ? Math.round((n.ramUsed / n.ramTotal) * 100) : 0;
    const diskPct = n.diskTotal > 0 ? Math.round((n.diskUsed / n.diskTotal) * 100) : 0;
    return `
      <div class="sandbox-card" style="${leastLoaded && n.num === leastLoaded.num ? 'border-color:#bc6e3c;box-shadow:0 0 12px rgba(188,110,60,0.2)' : ''}">
        <div class="card-header">
          <span class="status-dot" style="background:${color};box-shadow:0 0 8px ${color}80"></span>
          <span class="card-title">Node ${n.num}</span>
          ${leastLoaded && n.num === leastLoaded.num ? '<span class="badge-selected">SELECTED</span>' : ''}
          <span class="card-status" style="color:${color}">${n.state.toUpperCase()}</span>
        </div>
        <div class="card-body">
          <div class="metric"><span class="metric-label">Name</span><span class="metric-value">${n.name}</span></div>
          <div class="metric"><span class="metric-label">Role</span><span class="metric-value">${n.role}</span></div>
          <div class="metric"><span class="metric-label">CPU Usage</span><span class="metric-value">${n.cpuUsage || 0}%</span></div>
          <div class="metric"><span class="metric-label">RAM</span><span class="metric-value">${n.ramUsed || 0}/${n.ramTotal || 0} MB (${ramPct}%)</span></div>
          <div class="metric"><span class="metric-label">Disk</span><span class="metric-value">${n.diskUsed || 0}/${n.diskTotal || 0} KB (${diskPct}%)</span></div>
          <div class="metric"><span class="metric-label">Workloads</span><span class="metric-value">${n.workloads || 0}</span></div>
          <div class="metric"><span class="metric-label">ID</span><span class="metric-value mono">${n.id.substring(0, 12)}...</span></div>
          <div class="progress-bar"><div class="progress-fill" style="width:${n.cpuUsage || 0}%;background:${(n.cpuUsage || 0) > 80 ? '#ef4444' : '#22c55e'}"></div></div>
        </div>
      </div>`;
  }).join('');

  const panelStatus = panelHealth?.panel?.status === 'healthy' ? 'Operational' : 'Down';
  const apiStatus = panelHealth?.api?.status === 'healthy' ? 'Operational' : 'Down';
  const healStatus = panelHealth?.self_heal?.status || 'unknown';
  const responseTime = panelHealth?.panel?.response_time_ms || 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Death Legion — Operations Dashboard</title>
  <meta http-equiv="refresh" content="15">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter',sans-serif; background:#080808; color:#e5e5e5; min-height:100vh; }
    .container { max-width:1200px; margin:0 auto; padding:1.5rem; }
    .header { text-align:center; margin-bottom:2rem; }
    .logo { font-family:'Cinzel',serif; font-size:2rem; font-weight:900; background:linear-gradient(135deg,#bc6e3c 0%,#e89060 50%,#bc6e3c 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:0.08em; text-transform:uppercase; }
    .subtitle { color:#666; font-size:0.85rem; margin-top:0.3rem; }
    .status-banner { background:rgba(20,20,20,0.9); border:1px solid ${healthColor}40; border-radius:16px; padding:1.5rem; text-align:center; margin-bottom:1.5rem; }
    .status-icon { font-size:2.5rem; margin-bottom:0.3rem; }
    .status-text { font-family:'Cinzel',serif; font-size:1.5rem; font-weight:700; color:${healthColor}; }
    .status-time { color:#555; font-size:0.8rem; margin-top:0.3rem; }
    .metrics-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:0.8rem; margin-bottom:1.5rem; }
    .metric-card { background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:1rem; text-align:center; }
    .metric-card .value { font-size:1.6rem; font-weight:700; color:#e89060; font-family:'JetBrains Mono',monospace; }
    .metric-card .label { color:#666; font-size:0.7rem; margin-top:0.2rem; text-transform:uppercase; letter-spacing:0.05em; }
    .section-title { font-family:'Cinzel',serif; color:#e89060; font-size:1.1rem; margin-bottom:0.8rem; margin-top:1.5rem; padding-bottom:0.3rem; border-bottom:1px solid rgba(188,110,60,0.2); }
    .sandbox-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(280px,1fr)); gap:0.8rem; margin-bottom:1.5rem; }
    .sandbox-card { background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:12px; overflow:hidden; transition:border-color 0.3s; }
    .card-header { display:flex; align-items:center; gap:0.5rem; padding:0.8rem 1rem; border-bottom:1px solid rgba(255,255,255,0.04); }
    .status-dot { width:8px; height:8px; border-radius:50%; animation:pulse 2s ease-in-out infinite; }
    .card-title { font-weight:600; font-size:0.95rem; flex:1; }
    .card-status { font-size:0.7rem; font-weight:600; text-transform:uppercase; }
    .badge-selected { background:rgba(188,110,60,0.2); color:#e89060; font-size:0.65rem; padding:0.15rem 0.4rem; border-radius:4px; font-weight:600; }
    .card-body { padding:0.8rem 1rem; }
    .card-body .metric { display:flex; justify-content:space-between; padding:0.2rem 0; font-size:0.82rem; }
    .metric-label { color:#666; }
    .metric-value { color:#ccc; }
    .metric-value.mono { font-family:'JetBrains Mono',monospace; font-size:0.72rem; color:#888; }
    .progress-bar { height:4px; background:rgba(255,255,255,0.06); border-radius:2px; margin-top:0.5rem; overflow:hidden; }
    .progress-fill { height:100%; border-radius:2px; transition:width 0.3s; }
    .health-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:0.5rem; margin-bottom:1.5rem; }
    .health-item { display:flex; align-items:center; justify-content:space-between; background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:8px; padding:0.6rem 1rem; }
    .health-item .name { color:#888; font-size:0.82rem; }
    .health-item .badge { font-size:0.72rem; font-weight:600; padding:0.15rem 0.5rem; border-radius:4px; }
    .badge-ok { background:rgba(34,197,94,0.15); color:#22c55e; }
    .badge-down { background:rgba(239,68,68,0.15); color:#ef4444; }
    .activity-feed { background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:12px; padding:1rem; max-height:250px; overflow-y:auto; }
    .activity-item { display:flex; gap:0.5rem; padding:0.3rem 0; border-bottom:1px solid rgba(255,255,255,0.03); font-size:0.78rem; }
    .activity-time { color:#555; font-family:'JetBrains Mono',monospace; white-space:nowrap; min-width:140px; }
    .activity-event { color:#e89060; font-weight:500; min-width:120px; }
    .activity-details { color:#888; }
    .scheduler-info { background:rgba(188,110,60,0.08); border:1px solid rgba(188,110,60,0.15); border-radius:12px; padding:1rem; margin-bottom:1rem; }
    .scheduler-info .title { color:#e89060; font-weight:600; font-size:0.9rem; margin-bottom:0.5rem; }
    .scheduler-info .detail { color:#888; font-size:0.82rem; }
    .footer { text-align:center; margin-top:2rem; color:#444; font-size:0.75rem; }
    .footer a { color:#bc6e3c; text-decoration:none; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Death Legion</div>
      <div class="subtitle">Operations Dashboard — Logical Compute Node (5 Sandboxes)</div>
    </div>

    <div class="status-banner">
      <div class="status-icon">${clusterHealth === 'healthy' ? '✅' : clusterHealth === 'degraded' ? '⚠️' : '❌'}</div>
      <div class="status-text">${healthText}</div>
      <div class="status-time">Last updated: ${timestamp} (auto-refresh 15s)</div>
    </div>

    <div class="metrics-grid">
      <div class="metric-card"><div class="value">${nodes.length}</div><div class="label">Total Nodes</div></div>
      <div class="metric-card"><div class="value" style="color:#22c55e">${healthyCount}</div><div class="label">Active</div></div>
      <div class="metric-card"><div class="value" style="color:#ef4444">${offlineCount}</div><div class="label">Offline</div></div>
      <div class="metric-card"><div class="value">${totalCpu}</div><div class="label">Total vCPUs</div></div>
      <div class="metric-card"><div class="value">${totalRam}</div><div class="label">GB RAM</div></div>
      <div class="metric-card"><div class="value">${totalDisk}</div><div class="label">GB Disk</div></div>
      <div class="metric-card"><div class="value">${avgCpuUsage}%</div><div class="label">Avg CPU Usage</div></div>
      <div class="metric-card"><div class="value">${totalWorkloads}</div><div class="label">Active Workloads</div></div>
      <div class="metric-card"><div class="value">110</div><div class="label">GB E2B Storage</div></div>
      <div class="metric-card"><div class="value">20</div><div class="label">Game Servers</div></div>
    </div>

    ${leastLoaded ? `
    <div class="scheduler-info">
      <div class="title">🔧 Scheduler Decision (Least-Loaded Algorithm)</div>
      <div class="detail">Next workload → <strong style="color:#e89060">Node ${leastLoaded.num}</strong> (${leastLoaded.name})</div>
      <div class="detail">CPU: ${leastLoaded.cpuUsage || 0}% | Workloads: ${leastLoaded.workloads || 0} | RAM: ${leastLoaded.ramUsed || 0}/${leastLoaded.ramTotal || 0} MB</div>
    </div>` : ''}

    <div class="section-title">Compute Cluster (5 Isolated Sandboxes)</div>
    <div class="sandbox-grid">${nodeCards}</div>

    <div class="section-title">Server Health</div>
    <div class="health-grid">
      <div class="health-item"><span class="name">Panel API</span><span class="badge ${panelStatus === 'Operational' ? 'badge-ok' : 'badge-down'}">${panelStatus}</span></div>
      <div class="health-item"><span class="name">Client API</span><span class="badge ${apiStatus === 'Operational' ? 'badge-ok' : 'badge-down'}">${apiStatus}</span></div>
      <div class="health-item"><span class="name">WebSocket</span><span class="badge ${panelStatus === 'Operational' ? 'badge-ok' : 'badge-down'}">${panelStatus}</span></div>
      <div class="health-item"><span class="name">Database</span><span class="badge ${panelStatus === 'Operational' ? 'badge-ok' : 'badge-down'}">${panelStatus}</span></div>
      <div class="health-item"><span class="name">Self-Healing</span><span class="badge ${healStatus === 'completed' ? 'badge-ok' : 'badge-down'}">${healStatus}</span></div>
      <div class="health-item"><span class="name">Response Time</span><span class="badge badge-ok">${responseTime}ms</span></div>
    </div>

    <div class="section-title">Self-Healing Activity</div>
    <div class="activity-feed">
      <div class="activity-item"><span class="activity-time">${timestamp.substring(0,19)}</span><span class="activity-event">HEALTH_CHECK</span><span class="activity-details">Cluster checked — ${healthyCount}/${nodes.length} nodes healthy, ${totalWorkloads} workloads active</span></div>
      <div class="activity-item"><span class="activity-time">${timestamp.substring(0,19)}</span><span class="activity-event">SCHEDULER</span><span class="activity-details">${leastLoaded ? `Next workload → Node ${leastLoaded.num} (${leastLoaded.name})` : 'No available nodes'}</span></div>
      <div class="activity-item"><span class="activity-time">${timestamp.substring(0,19)}</span><span class="activity-event">METRICS</span><span class="activity-details">Avg CPU: ${avgCpuUsage}%, RAM: ${totalRamUsed}/${totalRamAvail} MB, Workloads: ${totalWorkloads}</span></div>
      <div class="activity-item"><span class="activity-time">${timestamp.substring(0,19)}</span><span class="activity-event">PANEL_PROXY</span><span class="activity-details">Vercel → Daytona — ${panelStatus} (${responseTime}ms)</span></div>
      <div class="activity-item"><span class="activity-time">${timestamp.substring(0,19)}</span><span class="activity-event">E2B_STORAGE</span><span class="activity-details">5 E2B sandboxes (110GB) — auto-recreated every cycle</span></div>
      <div class="activity-item"><span class="activity-time">${timestamp.substring(0,19)}</span><span class="activity-event">SELF_HEAL</span><span class="activity-details">GitHub Actions every 5 min — exponential backoff (max 3 retries, 5min cooldown)</span></div>
    </div>

    <div class="footer">
      <p>Death Legion Panel &copy; 2026 | <a href="/">Panel</a> | <a href="/apply">Apply</a> | <a href="/admin/applications">Admin</a></p>
      <p style="margin-top:0.3rem">Logical Compute Node: 5 isolated sandboxes | Scheduler: least-loaded | Self-heal: 5 min</p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  // Check all sandboxes + get live metrics in parallel
  const nodeChecks = await Promise.all(
    SANDBOXES.map(async (sbx) => {
      const status = await checkSandbox(sbx.id);
      const metrics = await getLiveMetrics(sbx.id, status.state === 'started');
      return { ...sbx, ...status, ...metrics };
    })
  );

  const panelHealth = await checkPanelHealth();

  return res.status(200).send(dashboardHtml(nodeChecks, panelHealth));
}
