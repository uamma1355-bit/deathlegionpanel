import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
const DAYTONA_API = 'https://app.daytona.io/api';
const PANEL_SANDBOX = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';

interface SandboxStats {
  state: string;
  cpu: number;
  memory: number;
  disk: number;
}

interface LiveMetrics {
  cpuUsage: number;
  cpuUser: number;
  cpuSystem: number;
  cpuCores: number;
  loadAvg1: number;
  loadAvg5: number;
  loadAvg15: number;
  ramUsed: number;
  ramTotal: number;
  ramFree: number;
  ramCached: number;
  ramSwapUsed: number;
  ramSwapTotal: number;
  diskUsed: number;
  diskTotal: number;
  diskFree: number;
  diskInodes: number;
  diskInodesUsed: number;
  netRx: number;
  netTx: number;
  processes: number;
  workloads: number;
  uptime: number;
}

interface ContainerStat {
  name: string;
  serverName: string;
  cpuPct: number;
  memUsage: number;
  memLimit: number;
  memPct: number;
  netRx: number;
  netTx: number;
  blockRead: number;
  blockWrite: number;
  status: string;
  owner: string;
}

interface ServerInfo {
  uuid: string;
  name: string;
  owner: string;
  status: string;
  memory: number;
  disk: number;
  cpu: number;
}

async function execInSandbox(sandboxId: string, command: string, timeout = 15): Promise<string> {
  try {
    const resp = await fetch(`${DAYTONA_API}/toolbox/${sandboxId}/toolbox/process/execute`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd: '/home/daytona', timeout }),
      signal: AbortSignal.timeout((timeout + 10) * 1000),
    });
    const data = await resp.json() as any;
    return data.result || '';
  } catch {
    return '';
  }
}

async function checkSandbox(sandboxId: string): Promise<SandboxStats> {
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

async function getLiveMetrics(sandboxId: string, isStarted: boolean): Promise<LiveMetrics> {
  const zero: LiveMetrics = {
    cpuUsage: 0, cpuUser: 0, cpuSystem: 0, cpuCores: 0,
    loadAvg1: 0, loadAvg5: 0, loadAvg15: 0,
    ramUsed: 0, ramTotal: 0, ramFree: 0, ramCached: 0, ramSwapUsed: 0, ramSwapTotal: 0,
    diskUsed: 0, diskTotal: 0, diskFree: 0, diskInodes: 0, diskInodesUsed: 0,
    netRx: 0, netTx: 0, processes: 0, workloads: 0, uptime: 0,
  };
  if (!isStarted) return zero;

  const cmd = `CPU_LINE=$(top -bn1 | grep 'Cpu(s)' | head -1)
CPU_US=$(echo "$CPU_LINE" | awk '{print $2}' | cut -d% -f1)
CPU_SY=$(echo "$CPU_LINE" | awk '{print $4}' | cut -d% -f1)
CPU_IDLE=$(echo "$CPU_LINE" | awk '{print $8}' | cut -d% -f1)
CPU_USE=$(awk "BEGIN{print 100-$CPU_IDLE}" 2>/dev/null)
CORES=$(nproc 2>/dev/null || echo 1)
LOAD=$(cat /proc/loadavg 2>/dev/null)
LOAD1=$(echo "$LOAD" | awk '{print $1}')
LOAD5=$(echo "$LOAD" | awk '{print $2}')
LOAD15=$(echo "$LOAD" | awk '{print $3}')
RAM=$(free -m 2>/dev/null | grep Mem)
RAM_T=$(echo "$RAM" | awk '{print $2}')
RAM_U=$(echo "$RAM" | awk '{print $3}')
RAM_F=$(echo "$RAM" | awk '{print $4}')
RAM_C=$(echo "$RAM" | awk '{print $6}')
SWAP=$(free -m 2>/dev/null | grep Swap)
SWAP_T=$(echo "$SWAP" | awk '{print $2}')
SWAP_U=$(echo "$SWAP" | awk '{print $3}')
DISK=$(df / 2>/dev/null | tail -1)
DISK_T=$(echo "$DISK" | awk '{print $2}')
DISK_U=$(echo "$DISK" | awk '{print $3}')
DISK_F=$(echo "$DISK" | awk '{print $4}')
INODES=$(df -i / 2>/dev/null | tail -1)
INODES_T=$(echo "$INODES" | awk '{print $2}')
INODES_U=$(echo "$INODES" | awk '{print $3}')
NET=$(cat /proc/net/dev 2>/dev/null | grep -E 'eth0|ens0' | head -1 | awk '{print $2":"$10}')
NET_RX=$(echo "$NET" | cut -d: -f1)
NET_TX=$(echo "$NET" | cut -d: -f2)
PROCS=$(ls /proc 2>/dev/null | grep -c '^[0-9]')
WL=$(pgrep -c -f 'php8.4|wings|dockerd|nginx|redis|mariadbd' 2>/dev/null || echo 0)
UP=$(awk '{print int($1/86400)"d "int(($1%86400)/3600)"h "int(($1%3600)/60)"m"}' /proc/uptime 2>/dev/null || echo 0)
echo "{\\"cpu\\":$CPU_USE,\\"cpu_us\\":$CPU_US,\\"cpu_sy\\":$CPU_SY,\\"cores\\":$CORES,\\"load1\\":$LOAD1,\\"load5\\":$LOAD5,\\"load15\\":$LOAD15,\\"ram_u\\":$RAM_U,\\"ram_t\\":$RAM_T,\\"ram_f\\":$RAM_F,\\"ram_c\\":$RAM_C,\\"swap_u\\":$SWAP_U,\\"swap_t\\":$SWAP_T,\\"disk_u\\":$DISK_U,\\"disk_t\\":$DISK_T,\\"disk_f\\":$DISK_F,\\"inodes_t\\":$INODES_T,\\"inodes_u\\":$INODES_U,\\"net_rx\\":$NET_RX,\\"net_tx\\":$NET_TX,\\"procs\\":$PROCS,\\"wl\\":$WL,\\"up\\":\\"$UP\\"}"`;

  try {
    const result = await execInSandbox(sandboxId, cmd, 15);
    const m = JSON.parse(result.trim());
    return {
      cpuUsage: parseFloat(m.cpu) || 0,
      cpuUser: parseFloat(m.cpu_us) || 0,
      cpuSystem: parseFloat(m.cpu_sy) || 0,
      cpuCores: m.cores || 1,
      loadAvg1: parseFloat(m.load1) || 0,
      loadAvg5: parseFloat(m.load5) || 0,
      loadAvg15: parseFloat(m.load15) || 0,
      ramUsed: m.ram_u || 0,
      ramTotal: m.ram_t || 0,
      ramFree: m.ram_f || 0,
      ramCached: m.ram_c || 0,
      ramSwapUsed: m.swap_u || 0,
      ramSwapTotal: m.swap_t || 0,
      diskUsed: m.disk_u || 0,
      diskTotal: m.disk_t || 0,
      diskFree: m.disk_f || 0,
      diskInodes: m.inodes_t || 0,
      diskInodesUsed: m.inodes_u || 0,
      netRx: m.net_rx || 0,
      netTx: m.net_tx || 0,
      processes: m.procs || 0,
      workloads: m.wl || 0,
      uptime: m.up || '0',
    };
  } catch {
    return zero;
  }
}

async function getContainerStats(): Promise<ContainerStat[]> {
  // Get all running docker containers and their stats in one go
  const cmd = `sudo docker ps --format '{{.Names}}' 2>/dev/null | while read CN; do
  if [ -z "$CN" ]; then continue; fi
  STATS=$(sudo docker stats --no-stream --format '{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}|{{.NetIO}}|{{.BlockIO}}' "$CN" 2>/dev/null)
  echo "$CN|$STATS"
done`;

  try {
    const result = await execInSandbox(PANEL_SANDBOX, cmd, 30);
    if (!result.trim()) return [];

    // Also get server UUID -> name mapping from MySQL
    const serversCmd = `mysql -u pterodactyl -p'ptero_app_pw_2025' pterodactyl -N -e "SELECT s.uuid, s.name, u.username, s.status, s.memory, s.disk, s.cpu FROM servers s JOIN users u ON s.owner_id=u.id ORDER BY s.id;" 2>/dev/null`;
    const serversResult = await execInSandbox(PANEL_SANDBOX, serversCmd, 10);

    const serverMap: Record<string, ServerInfo> = {};
    for (const line of serversResult.split('\n')) {
      const parts = line.split('\t');
      if (parts.length >= 7 && parts[0].length === 36) {
        serverMap[parts[0]] = {
          uuid: parts[0],
          name: parts[1],
          owner: parts[2],
          status: parts[3],
          memory: parseInt(parts[4]) || 0,
          disk: parseInt(parts[5]) || 0,
          cpu: parseInt(parts[6]) || 0,
        };
      }
    }

    const containers: ContainerStat[] = [];
    for (const line of result.split('\n')) {
      if (!line.trim()) continue;
      const parts = line.split('|');
      if (parts.length < 2) continue;
      const name = parts[0];
      const cpuPct = parseFloat((parts[1] || '0%').replace('%', '')) || 0;
      const memParts = (parts[2] || '0 / 0').split('/');
      const memUsage = parseMem(memParts[0]);
      const memLimit = parseMem(memParts[1] || '0');
      const memPct = parseFloat((parts[3] || '0%').replace('%', '')) || 0;
      const netParts = (parts[4] || '0B / 0B').split('/');
      const netRx = parseBytes(netParts[0]);
      const netTx = parseBytes(netParts[1] || '0B');
      const blockParts = (parts[5] || '0B / 0B').split('/');
      const blockRead = parseBytes(blockParts[0]);
      const blockWrite = parseBytes(blockParts[1] || '0B');

      const srv = serverMap[name] || { name: name, owner: 'unknown', status: 'unknown', memory: 0, disk: 0, cpu: 0, uuid: name };

      containers.push({
        name,
        serverName: srv.name,
        owner: srv.owner,
        cpuPct,
        memUsage,
        memLimit,
        memPct,
        netRx,
        netTx,
        blockRead,
        blockWrite,
        status: srv.status,
      });
    }
    return containers.sort((a, b) => b.cpuPct - a.cpuPct);
  } catch {
    return [];
  }
}

function parseMem(s: string): number {
  s = s.trim();
  if (s.endsWith('MiB')) return parseFloat(s) || 0;
  if (s.endsWith('GiB')) return (parseFloat(s) || 0) * 1024;
  if (s.endsWith('KiB')) return (parseFloat(s) || 0) / 1024;
  if (s.endsWith('B')) return (parseFloat(s) || 0) / (1024 * 1024);
  return parseFloat(s) || 0;
}

function parseBytes(s: string): number {
  s = s.trim();
  if (s.endsWith('kB')) return parseFloat(s) * 1024;
  if (s.endsWith('MB')) return parseFloat(s) * 1024 * 1024;
  if (s.endsWith('GB')) return parseFloat(s) * 1024 * 1024 * 1024;
  if (s.endsWith('TB')) return parseFloat(s) * 1024 * 1024 * 1024 * 1024;
  if (s.endsWith('B')) return parseFloat(s);
  return parseFloat(s) || 0;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes.toFixed(0) + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}

function formatKB(kb: number): string {
  if (kb < 1024) return kb.toFixed(0) + ' KB';
  if (kb < 1024 * 1024) return (kb / 1024).toFixed(1) + ' MB';
  return (kb / 1024 / 1024).toFixed(2) + ' GB';
}

function formatMB(mb: number): string {
  if (mb < 1024) return mb.toFixed(0) + ' MB';
  return (mb / 1024).toFixed(2) + ' GB';
}

function renderHtml(
  metrics: LiveMetrics,
  containers: ContainerStat[],
  sandboxStats: SandboxStats,
): string {
  const now = new Date();
  const timestamp = now.toISOString();
  const localTime = now.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });

  const ramPct = metrics.ramTotal > 0 ? (metrics.ramUsed / metrics.ramTotal) * 100 : 0;
  const diskPct = metrics.diskTotal > 0 ? (metrics.diskUsed / metrics.diskTotal) * 100 : 0;
  const swapPct = metrics.ramSwapTotal > 0 ? (metrics.ramSwapUsed / metrics.ramSwapTotal) * 100 : 0;
  const inodePct = metrics.diskInodes > 0 ? (metrics.diskInodesUsed / metrics.diskInodes) * 100 : 0;
  const loadPerCore = metrics.cpuCores > 0 ? metrics.loadAvg1 / metrics.cpuCores : 0;

  const ramColor = ramPct > 85 ? '#ef4444' : ramPct > 70 ? '#f59e0b' : '#22c55e';
  const diskColor = diskPct > 85 ? '#ef4444' : diskPct > 70 ? '#f59e0b' : '#22c55e';
  const cpuColor = metrics.cpuUsage > 85 ? '#ef4444' : metrics.cpuUsage > 70 ? '#f59e0b' : '#22c55e';
  const swapColor = swapPct > 80 ? '#ef4444' : swapPct > 50 ? '#f59e0b' : '#22c55e';

  const totalContainerCpu = containers.reduce((s, c) => s + c.cpuPct, 0);
  const totalContainerMem = containers.reduce((s, c) => s + c.memUsage, 0);
  const totalContainerNetRx = containers.reduce((s, c) => s + c.netRx, 0);
  const totalContainerNetTx = containers.reduce((s, c) => s + c.netTx, 0);

  const containerRows = containers.length > 0
    ? containers.map(c => {
        const cMemColor = c.memPct > 85 ? '#ef4444' : c.memPct > 70 ? '#f59e0b' : '#22c55e';
        const cCpuColor = c.cpuPct > 85 ? '#ef4444' : c.cpuPct > 70 ? '#f59e0b' : '#22c55e';
        return `
        <tr>
          <td><div class="cell-primary">${c.serverName}</div><div class="cell-secondary">${c.name.substring(0, 12)}</div></td>
          <td><span class="owner-badge">${c.owner}</span></td>
          <td><span class="status-pill" style="background:${c.status === 'running' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'};color:${c.status === 'running' ? '#22c55e' : '#ef4444'}">${c.status}</span></td>
          <td>
            <div class="cell-with-bar">
              <span style="color:${cCpuColor};font-weight:600">${c.cpuPct.toFixed(2)}%</span>
              <div class="mini-bar"><div class="mini-bar-fill" style="width:${Math.min(100, c.cpuPct)}%;background:${cCpuColor}"></div></div>
            </div>
          </td>
          <td>
            <div class="cell-with-bar">
              <span style="color:${cMemColor};font-weight:600">${formatMB(c.memUsage)} / ${formatMB(c.memLimit)}</span>
              <div class="mini-bar"><div class="mini-bar-fill" style="width:${c.memPct}%;background:${cMemColor}"></div></div>
            </div>
          </td>
          <td><span class="mono-small">${formatBytes(c.netRx)}</span> / <span class="mono-small">${formatBytes(c.netTx)}</span></td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="6" class="empty-state">No running containers. Start a server from the panel to see live container stats.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Death Legion — Live Statistics</title>
  <meta http-equiv="refresh" content="10">
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Inter',sans-serif; background:#080808; color:#e5e5e5; min-height:100vh; padding:1.5rem; }
    .container { max-width:1300px; margin:0 auto; }
    .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:1.5rem; padding-bottom:1rem; border-bottom:1px solid rgba(188,110,60,0.2); }
    .header-left { display:flex; align-items:center; gap:1rem; }
    .logo { font-family:'Cinzel',serif; font-size:1.6rem; font-weight:900; background:linear-gradient(135deg,#bc6e3c 0%,#e89060 50%,#bc6e3c 100%); -webkit-background-clip:text; -webkit-text-fill-color:transparent; letter-spacing:0.08em; text-transform:uppercase; }
    .page-title { font-family:'Cinzel',serif; color:#e89060; font-size:1.1rem; letter-spacing:0.05em; }
    .header-right { display:flex; align-items:center; gap:1rem; }
    .live-indicator { display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; color:#888; }
    .live-dot { width:8px; height:8px; border-radius:50%; background:#22c55e; animation:pulse 1.5s ease-in-out infinite; box-shadow:0 0 8px #22c55e80; }
    .last-update { color:#555; font-size:0.75rem; font-family:'JetBrains Mono',monospace; }
    .nav-links { display:flex; gap:0.5rem; margin-bottom:1.5rem; flex-wrap:wrap; }
    .nav-link { padding:0.4rem 0.9rem; background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:8px; color:#888; text-decoration:none; font-size:0.82rem; transition:all 0.2s; }
    .nav-link:hover { border-color:rgba(188,110,60,0.3); color:#e89060; }
    .nav-link.active { background:rgba(188,110,60,0.15); border-color:rgba(188,110,60,0.4); color:#e89060; }

    /* Hero stat cards */
    .hero-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(280px,1fr)); gap:1rem; margin-bottom:1.5rem; }
    .hero-card { background:linear-gradient(135deg,rgba(20,20,20,0.9) 0%,rgba(15,15,15,0.9) 100%); border:1px solid rgba(255,255,255,0.06); border-radius:16px; padding:1.3rem; position:relative; overflow:hidden; }
    .hero-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--accent); }
    .hero-card.cpu { --accent:${cpuColor}; }
    .hero-card.ram { --accent:${ramColor}; }
    .hero-card.disk { --accent:${diskColor}; }
    .hero-card.swap { --accent:${swapColor}; }
    .hero-label { display:flex; align-items:center; gap:0.5rem; color:#888; font-size:0.75rem; text-transform:uppercase; letter-spacing:0.08em; margin-bottom:0.5rem; }
    .hero-label .icon { font-size:1rem; }
    .hero-value { font-family:'JetBrains Mono',monospace; font-size:2rem; font-weight:700; color:var(--accent); line-height:1; margin-bottom:0.4rem; }
    .hero-sub { color:#666; font-size:0.78rem; }
    .hero-bar { height:6px; background:rgba(255,255,255,0.06); border-radius:3px; margin-top:0.8rem; overflow:hidden; }
    .hero-bar-fill { height:100%; background:var(--accent); border-radius:3px; transition:width 0.5s; box-shadow:0 0 8px var(--accent)80; }

    /* Section title */
    .section-title { font-family:'Cinzel',serif; color:#e89060; font-size:1.05rem; margin:1.8rem 0 0.8rem 0; padding-bottom:0.4rem; border-bottom:1px solid rgba(188,110,60,0.15); display:flex; align-items:center; gap:0.5rem; }
    .section-title .count { background:rgba(188,110,60,0.15); color:#e89060; font-size:0.7rem; padding:0.15rem 0.5rem; border-radius:4px; font-weight:600; font-family:'Inter',sans-serif; }

    /* Detail grid */
    .detail-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:0.7rem; margin-bottom:1.5rem; }
    .detail-card { background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:0.9rem 1rem; }
    .detail-card .label { color:#666; font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; margin-bottom:0.3rem; }
    .detail-card .value { font-family:'JetBrains Mono',monospace; font-size:1.05rem; font-weight:600; color:#e5e5e5; }
    .detail-card .sub { color:#666; font-size:0.72rem; margin-top:0.2rem; }

    /* Network mini-cards */
    .net-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:0.7rem; margin-bottom:1.5rem; }
    .net-card { background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:10px; padding:0.9rem 1rem; display:flex; align-items:center; gap:0.8rem; }
    .net-card .icon { font-size:1.4rem; }
    .net-card .info { flex:1; }
    .net-card .label { color:#666; font-size:0.7rem; text-transform:uppercase; }
    .net-card .value { font-family:'JetBrains Mono',monospace; font-size:0.95rem; font-weight:600; color:#e89060; }

    /* Container table */
    .table-wrap { background:rgba(20,20,20,0.8); border:1px solid rgba(255,255,255,0.06); border-radius:12px; overflow:hidden; margin-bottom:1.5rem; }
    .table-scroll { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; }
    th { background:rgba(188,110,60,0.08); color:#e89060; font-family:'Cinzel',serif; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em; padding:0.7rem 1rem; text-align:left; font-weight:600; }
    td { padding:0.7rem 1rem; border-top:1px solid rgba(255,255,255,0.03); font-size:0.82rem; color:#ccc; vertical-align:top; }
    tr:hover td { background:rgba(255,255,255,0.02); }
    .cell-primary { font-weight:600; color:#e5e5e5; }
    .cell-secondary { color:#666; font-size:0.7rem; font-family:'JetBrains Mono',monospace; margin-top:0.15rem; }
    .cell-with-bar { min-width:130px; }
    .cell-with-bar span { display:block; margin-bottom:0.25rem; font-size:0.78rem; font-family:'JetBrains Mono',monospace; }
    .mini-bar { height:3px; background:rgba(255,255,255,0.06); border-radius:2px; overflow:hidden; }
    .mini-bar-fill { height:100%; border-radius:2px; transition:width 0.3s; }
    .owner-badge { background:rgba(188,110,60,0.1); color:#e89060; padding:0.15rem 0.5rem; border-radius:4px; font-size:0.72rem; font-weight:600; }
    .status-pill { padding:0.15rem 0.5rem; border-radius:4px; font-size:0.7rem; font-weight:600; text-transform:uppercase; }
    .mono-small { font-family:'JetBrains Mono',monospace; font-size:0.75rem; color:#888; }
    .empty-state { text-align:center; color:#666; padding:2rem; font-style:italic; }

    .footer { text-align:center; margin-top:2rem; padding-top:1rem; border-top:1px solid rgba(255,255,255,0.04); color:#444; font-size:0.75rem; }
    .footer a { color:#bc6e3c; text-decoration:none; }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
    @media (max-width:768px) {
      .header { flex-direction:column; gap:0.5rem; align-items:flex-start; }
      .hero-value { font-size:1.5rem; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-left">
        <div class="logo">Death Legion</div>
        <div class="page-title">Live Statistics</div>
      </div>
      <div class="header-right">
        <div class="live-indicator"><div class="live-dot"></div>LIVE (refresh 10s)</div>
        <div class="last-update">${localTime} UTC</div>
      </div>
    </div>

    <div class="nav-links">
      <a href="/" class="nav-link">Panel</a>
      <a href="/statistics" class="nav-link active">Statistics</a>
      <a href="/status" class="nav-link">Status</a>
      <a href="/apply" class="nav-link">Apply</a>
    </div>

    <!-- Hero cards: CPU, RAM, Disk, Swap -->
    <div class="hero-grid">
      <div class="hero-card cpu">
        <div class="hero-label"><span class="icon">CPU</span> Processor Usage</div>
        <div class="hero-value">${metrics.cpuUsage.toFixed(1)}%</div>
        <div class="hero-sub">${metrics.cpuCores} core${metrics.cpuCores !== 1 ? 's' : ''} • User ${metrics.cpuUser.toFixed(1)}% • Sys ${metrics.cpuSystem.toFixed(1)}%</div>
        <div class="hero-bar"><div class="hero-bar-fill" style="width:${Math.min(100, metrics.cpuUsage)}%"></div></div>
      </div>
      <div class="hero-card ram">
        <div class="hero-label"><span class="icon">RAM</span> Memory Usage</div>
        <div class="hero-value">${formatMB(metrics.ramUsed)} <span style="color:#666;font-size:1.2rem">/ ${formatMB(metrics.ramTotal)}</span></div>
        <div class="hero-sub">${ramPct.toFixed(1)}% used • ${formatMB(metrics.ramFree)} free • ${formatMB(metrics.ramCached)} cached</div>
        <div class="hero-bar"><div class="hero-bar-fill" style="width:${ramPct}%"></div></div>
      </div>
      <div class="hero-card disk">
        <div class="hero-label"><span class="icon">DISK</span> Storage Usage</div>
        <div class="hero-value">${formatKB(metrics.diskUsed)} <span style="color:#666;font-size:1.2rem">/ ${formatKB(metrics.diskTotal)}</span></div>
        <div class="hero-sub">${diskPct.toFixed(1)}% used • ${formatKB(metrics.diskFree)} free • ${inodePct.toFixed(1)}% inodes</div>
        <div class="hero-bar"><div class="hero-bar-fill" style="width:${diskPct}%"></div></div>
      </div>
      <div class="hero-card swap">
        <div class="hero-label"><span class="icon">SWAP</span> Swap Memory</div>
        <div class="hero-value">${formatMB(metrics.ramSwapUsed)} <span style="color:#666;font-size:1.2rem">/ ${formatMB(metrics.ramSwapTotal)}</span></div>
        <div class="hero-sub">${swapPct.toFixed(1)}% used ${metrics.ramSwapTotal === 0 ? '• Swap disabled' : ''}</div>
        <div class="hero-bar"><div class="hero-bar-fill" style="width:${swapPct}%"></div></div>
      </div>
    </div>

    <!-- System details -->
    <div class="section-title">System Load &amp; Process Statistics</div>
    <div class="detail-grid">
      <div class="detail-card">
        <div class="label">Load Average (1m)</div>
        <div class="value">${metrics.loadAvg1.toFixed(2)}</div>
        <div class="sub">${loadPerCore.toFixed(2)} per core</div>
      </div>
      <div class="detail-card">
        <div class="label">Load Average (5m)</div>
        <div class="value">${metrics.loadAvg5.toFixed(2)}</div>
        <div class="sub">5-minute average</div>
      </div>
      <div class="detail-card">
        <div class="label">Load Average (15m)</div>
        <div class="value">${metrics.loadAvg15.toFixed(2)}</div>
        <div class="sub">15-minute average</div>
      </div>
      <div class="detail-card">
        <div class="label">Running Processes</div>
        <div class="value">${metrics.processes}</div>
        <div class="sub">total processes</div>
      </div>
      <div class="detail-card">
        <div class="label">Active Workloads</div>
        <div class="value">${metrics.workloads}</div>
        <div class="sub">panel + wings + docker</div>
      </div>
      <div class="detail-card">
        <div class="label">System Uptime</div>
        <div class="value">${metrics.uptime}</div>
        <div class="sub">since last reboot</div>
      </div>
      <div class="detail-card">
        <div class="label">Sandbox State</div>
        <div class="value" style="color:${sandboxStats.state === 'started' ? '#22c55e' : '#ef4444'}">${sandboxStats.state.toUpperCase()}</div>
        <div class="sub">${sandboxStats.cpu} vCPU • ${sandboxStats.memory}GB RAM • ${sandboxStats.disk}GB disk</div>
      </div>
      <div class="detail-card">
        <div class="label">Inodes Used</div>
        <div class="value">${metrics.diskInodesUsed.toLocaleString()} <span style="color:#666;font-size:0.85rem">/ ${metrics.diskInodes.toLocaleString()}</span></div>
        <div class="sub">${inodePct.toFixed(2)}% used</div>
      </div>
    </div>

    <!-- Network stats -->
    <div class="section-title">Network I/O Statistics</div>
    <div class="net-grid">
      <div class="net-card">
        <div class="icon">RX</div>
        <div class="info"><div class="label">Total Inbound</div><div class="value">${formatBytes(metrics.netRx)}</div></div>
      </div>
      <div class="net-card">
        <div class="icon">TX</div>
        <div class="info"><div class="label">Total Outbound</div><div class="value">${formatBytes(metrics.netTx)}</div></div>
      </div>
      <div class="net-card">
        <div class="icon">CTN</div>
        <div class="info"><div class="label">Containers Net RX</div><div class="value">${formatBytes(totalContainerNetRx)}</div></div>
      </div>
      <div class="net-card">
        <div class="icon">CTN</div>
        <div class="info"><div class="label">Containers Net TX</div><div class="value">${formatBytes(totalContainerNetTx)}</div></div>
      </div>
    </div>

    <!-- Container stats table -->
    <div class="section-title">
      Live Container Statistics
      <span class="count">${containers.length} running</span>
    </div>
    <div class="table-wrap">
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Server</th>
              <th>Owner</th>
              <th>Status</th>
              <th>CPU</th>
              <th>Memory</th>
              <th>Net I/O (RX / TX)</th>
            </tr>
          </thead>
          <tbody>
            ${containerRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Container summary -->
    ${containers.length > 0 ? `
    <div class="section-title">Container Aggregate Statistics</div>
    <div class="detail-grid">
      <div class="detail-card">
        <div class="label">Total Container CPU</div>
        <div class="value" style="color:${totalContainerCpu > 100 ? '#ef4444' : '#e89060'}">${totalContainerCpu.toFixed(2)}%</div>
        <div class="sub">across ${containers.length} container${containers.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="detail-card">
        <div class="label">Total Container Memory</div>
        <div class="value">${formatMB(totalContainerMem)}</div>
        <div class="sub">${(totalContainerMem / Math.max(1, metrics.ramTotal) * 100).toFixed(1)}% of host RAM</div>
      </div>
      <div class="detail-card">
        <div class="label">Highest CPU Container</div>
        <div class="value" style="font-size:0.95rem">${containers[0].serverName}</div>
        <div class="sub">${containers[0].cpuPct.toFixed(2)}% CPU • ${formatMB(containers[0].memUsage)} RAM</div>
      </div>
      <div class="detail-card">
        <div class="label">Highest Memory Container</div>
        <div class="value" style="font-size:0.95rem">${containers.reduce((a,b) => b.memUsage > a.memUsage ? b : a, containers[0]).serverName}</div>
        <div class="sub">${formatMB(containers.reduce((a,b) => b.memUsage > a.memUsage ? b : a, containers[0]).memUsage)} RAM</div>
      </div>
    </div>` : ''}

    <div class="footer">
      <p>Death Legion Panel &copy; 2026 — Live Statistics • Auto-refresh every 10 seconds</p>
      <p style="margin-top:0.3rem"><a href="/">Panel</a> | <a href="/status">Status</a> | <a href="/apply">Apply</a> | <a href="/statistics">Statistics</a></p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const sandboxStats = await checkSandbox(PANEL_SANDBOX);
    const isStarted = sandboxStats.state === 'started';

    // Run metrics and container stats in parallel for speed
    const [metrics, containers] = await Promise.all([
      getLiveMetrics(PANEL_SANDBOX, isStarted),
      getContainerStats(),
    ]);

    return res.status(200).send(renderHtml(metrics, containers, sandboxStats));
  } catch (err: any) {
    return res.status(500).send(`<!DOCTYPE html><html><body style="background:#080808;color:#e5e5e5;font-family:sans-serif;padding:2rem"><h1 style="color:#e89060">Statistics Error</h1><pre>${err.message}</pre><p><a href="/" style="color:#bc6e3c">Back to Panel</a></p></body></html>`);
  }
}
