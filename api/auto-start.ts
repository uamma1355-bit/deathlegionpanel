import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '16551277-c744-47d8-bbf4-f681442b1691';
const DAYTONA_API = 'https://app.daytona.io/api';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    // Check sandbox state
    const checkResp = await fetch(`${DAYTONA_API}/sandbox/${SANDBOX_ID}`, {
      headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}` },
      signal: AbortSignal.timeout(10000),
    });
    const sandbox = await checkResp.json() as any;
    const state = sandbox.state;

    if (state !== 'started') {
      // Start the sandbox
      console.log(`Sandbox state: ${state}, starting...`);
      await fetch(`${DAYTONA_API}/sandbox/${SANDBOX_ID}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}` },
        signal: AbortSignal.timeout(30000),
      });

      // Wait for it to start
      await new Promise(r => setTimeout(r, 30000));

      // Run start_all.sh
      const startResp = await fetch(`${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'sudo bash /opt/deathlegion/start_all.sh 2>&1', cwd: '/home/daytona', timeout: 60 }),
        signal: AbortSignal.timeout(90000),
      });
      const startResult = await startResp.json() as any;

      return res.status(200).json({
        status: 'restarted',
        previousState: state,
        startResult: (startResult.result || '').substring(0, 200),
      });
    }

    // Sandbox is running — check if Panel is responding
    const panelResp = await fetch(`${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ command: 'curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://127.0.0.1:8000/', cwd: '/home/daytona', timeout: 10 }),
      signal: AbortSignal.timeout(20000),
    });
    const panelResult = await panelResp.json() as any;
    const panelCode = (panelResult.result || '').trim();

    if (panelCode !== '200') {
      // Panel not responding — run start_all.sh
      console.log(`Panel HTTP ${panelCode}, running start_all.sh...`);
      await fetch(`${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: 'sudo bash /opt/deathlegion/start_all.sh 2>&1', cwd: '/home/daytona', timeout: 60 }),
        signal: AbortSignal.timeout(90000),
      });
      return res.status(200).json({ status: 'healed', panelCode });
    }

    return res.status(200).json({ status: 'healthy', state, panelCode });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
