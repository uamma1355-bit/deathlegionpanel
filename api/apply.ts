import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_PANEL_URL = 'https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu';
const ADMIN_API_KEY = '735E96098E5297C3df1d4a248922a35470e0d762fa4ef8cd58b37977';

const STARTUP_CMD = 'if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi; if [[ ! -z ${NODE_PACKAGES} ]]; then /usr/local/bin/npm install ${NODE_PACKAGES}; fi; if [[ ! -z ${UNNODE_PACKAGES} ]]; then /usr/local/bin/npm uninstall ${UNNODE_PACKAGES}; fi; if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi; if [[ "${MAIN_FILE}" == "*.js" ]]; then /usr/local/bin/node "/home/container/${MAIN_FILE}" ${NODE_ARGS}; else /usr/local/bin/ts-node --esm "/home/container/${MAIN_FILE}" ${NODE_ARGS}; fi';

const INDEX_JS = `console.log("Bot starting...");\nconsole.log("Connected");\nconsole.log("Bot ready");\nsetInterval(() => { console.log("Bot alive at " + new Date().toISOString()); }, 60000);\n`;

const PACKAGE_JSON = JSON.stringify({name:"deathlegion-bot",version:"1.0.0",main:"index.js",scripts:{start:"node index.js"},dependencies:{}},null,2);

const SERVER_NAMES = ['DeathLegion Bot 1', 'DeathLegion Bot 2'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const { first_name, last_name, username, email, password } = body;

    if (!first_name || !last_name || !username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must be 8+ chars' });

    // Step 1: Create user
    console.log('Creating user:', username);
    const userResp = await fetch(`${DAYTONA_PANEL_URL}/api/application/users`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, first_name, last_name, password, root_admin: false, language: 'en' }),
    });
    const userData = await userResp.json();

    if (userData.errors) {
      const err = userData.errors[0];
      return res.status(400).json({ error: err.detail || 'Failed to create user' });
    }

    const userId = userData.attributes.id;
    console.log('User created:', userId);

    // Step 2: Get allocations
    const allocResp = await fetch(`${DAYTONA_PANEL_URL}/api/application/nodes/1/allocations`, {
      headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Accept': 'application/json' },
    });
    const allocData = await allocResp.json();
    const available = (allocData.data || []).filter((a: any) => !a.attributes.assigned).slice(0, 2);
    console.log('Available allocations:', available.length);

    // Step 3: Create servers
    const servers = [];
    for (let i = 0; i < SERVER_NAMES.length && i < available.length; i++) {
      console.log('Creating server:', SERVER_NAMES[i]);
      const srvResp = await fetch(`${DAYTONA_PANEL_URL}/api/application/servers`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${ADMIN_API_KEY}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: SERVER_NAMES[i], user: userId, egg: 1,
          docker_image: 'ghcr.io/ptero-eggs/yolks:nodejs_24',
          startup: STARTUP_CMD,
          environment: { MAIN_FILE: 'index.js', NODE_ARGS: '', NODE_PACKAGES: '', AUTO_UPDATE: '0', GIT_ADDRESS: '', BRANCH: '', USER_UPLOAD: '1' },
          limits: { memory: 512, swap: 0, disk: 1024, io: 500, cpu: 100 },
          feature_limits: { databases: 1, allocations: 2, backups: 1 },
          allocation: { default: available[i].attributes.id },
          start_on_completion: false, skip_scripts: true,
        }),
      });
      const srvData = await srvResp.json();
      if (srvData.attributes) {
        servers.push({ id: srvData.attributes.id, uuid: srvData.attributes.uuid, name: srvData.attributes.name, identifier: srvData.attributes.identifier });
        // Install files via Wings (using admin API key + Panel file write)
        try {
          await fetch(`${DAYTONA_PANEL_URL}/api/client/servers/${srvData.attributes.identifier}/files/write?file=/index.js`, {
            method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'text/plain' }, body: INDEX_JS,
          });
          await fetch(`${DAYTONA_PANEL_URL}/api/client/servers/${srvData.attributes.identifier}/files/write?file=/package.json`, {
            method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'text/plain' }, body: PACKAGE_JSON,
          });
        } catch (e) { console.log('File install error:', e); }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Account and servers created!',
      user: { id: userId, username, email, first_name, last_name },
      servers,
      login: { username, password },
    });
  } catch (err) {
    console.error('Apply error:', err);
    return res.status(500).json({ error: 'Failed', detail: err instanceof Error ? err.message : String(err) });
  }
}
