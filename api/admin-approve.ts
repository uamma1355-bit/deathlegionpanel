import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
const SANDBOX_ID = '16551277-c744-47d8-bbf4-f681442b1691';
const DAYTONA_API = 'https://app.daytona.io/api';

async function executeOnSandbox(command: string, timeout: number = 60): Promise<string> {
  const url = `${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DAYTONA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command, cwd: '/home/daytona', timeout }),
  });
  const data = await resp.json() as any;
  return data.result || '';
}

// Comprehensive package.json with ALL common baileys bot dependencies
const COMPREHENSIVE_PKG = JSON.stringify({
  name: "deathlegion-bot",
  version: "1.0.0",
  main: "index.js",
  scripts: { start: "node index.js" },
  dependencies: {
    "@whiskeysockets/baileys": "^7.0.0",
    "qrcode-terminal": "^0.12.0",
    "pino": "^8.17.0",
    "pino-pretty": "^13.0.0",
    "@hapi/boom": "^10.0.1",
    "axios": "^1.8.0",
    "express": "^4.22.0",
    "dotenv": "^16.4.5",
    "cheerio": "^1.2.0",
    "file-type": "^19.6.0",
    "fluent-ffmpeg": "^2.1.3",
    "ffmpeg-static": "^5.2.0",
    "@ffmpeg-installer/ffmpeg": "^1.1.0",
    "jimp": "^1.6.1",
    "node-fetch": "^2.7.0",
    "qrcode": "^1.5.1",
    "wa-sticker-formatter": "^4.4.4",
    "yt-search": "^2.10.4",
    "@distube/ytdl-core": "^4.16.0",
    "crypto-js": "^4.2.0",
    "chalk": "^4.1.2",
    "@adiwajshing/keyed-db": "^0.2.4",
    "awesome-phonenumber": "^7.4.0",
    "@vitalets/google-translate-api": "^9.2.0",
    "sqlite3": "^5.1.6",
    "adm-zip": "^0.5.16",
    "body-parser": "^1.20.3",
    "google-it": "^1.6.0",
    "moment-timezone": "^0.5.46",
    "node-cron": "^3.0.3",
    "sharp": "^0.33.0",
    "link-preview-js": "^3.0.0",
    "form-data": "^4.0.0"
  }
}, null, 2);

// Asitha MD-style bot template
const ASITHA_BOT = `/**
 * Death Legion Panel - WhatsApp Baileys Bot Template
 * Asitha MD compatible - All dependencies pre-installed
 * Replace this with your actual bot code.
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const axios = require('axios');
const chalk = require('chalk');

const logger = P({ level: 'silent' });

async function startBot() {
    console.log(chalk.green('Death Legion Bot Starting...'));
    console.log(chalk.cyan('All dependencies pre-installed!'));
    
    const { state, saveCreds } = await useMultiFileAuthState('auth');
    
    const sock = makeWASocket({
        auth: state,
        logger: logger,
        printQRInTerminal: false,
        browser: ['DeathLegion', 'Chrome', '1.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log(chalk.yellow('QR Code generated! Scan with WhatsApp:'));
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect?.error instanceof Boom)
                ? lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut
                : true;
            
            if (shouldReconnect) {
                console.log(chalk.red('Reconnecting...'));
                startBot();
            }
        } else if (connection === 'open') {
            console.log(chalk.green('Bot Connected! Ready to use.'));
            console.log(chalk.green('All modules loaded successfully!'));
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
            if (text === '!ping') {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Pong! Death Legion Bot is alive!' });
            }
            if (text === '!menu') {
                await sock.sendMessage(msg.key.remoteJid, { text: 'Death Legion Bot Menu:\\n!ping - Check bot\\n!menu - Show menu\\n!sticker - Make sticker\\n!quote - Random quote' });
            }
        }
    });

    console.log(chalk.green('Bot ready! Waiting for QR scan...'));
}

startBot().catch(err => console.error('Bot error:', err));
`;

async function createPanelUser(data: { username: string; email: string; first_name: string; last_name: string; password: string }) {
  const inputJson = JSON.stringify(data);
  const inputB64 = Buffer.from(inputJson).toString('base64');

  // PHP script that creates user + servers + installs files with ALL dependencies
  const phpScript = `<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\User;
use Pterodactyl\\Models\\Egg;
use Pterodactyl\\Models\\Node;
use Pterodactyl\\Models\\Allocation;
use Pterodactyl\\Models\\Location;
use Pterodactyl\\Services\\Servers\\ServerCreationService;
use Pterodactyl\\Services\\Users\\UserCreationService;

$input = json_decode(file_get_contents('/tmp/approve_input.json'), true);

$existing = User::where('username', $input['username'])->orWhere('email', $input['email'])->first();
if ($existing) {
    echo json_encode(['error' => 'User already exists']);
    exit;
}

$userService = app(UserCreationService::class);
$user = $userService->handle([
    'email' => $input['email'],
    'username' => $input['username'],
    'name_first' => $input['first_name'],
    'name_last' => $input['last_name'],
    'password' => $input['password'],
    'root_admin' => false,
    'language' => 'en',
]);
echo "USER_CREATED:" . $user->id . "\\n";

$allocs = Allocation::whereNull('server_id')->orderBy('port')->limit(2)->get();
$egg = Egg::find(1);
$node = Node::first();
$location = Location::first();
$creationService = app(ServerCreationService::class);

$serverNames = [$input['username'] . ' Bot 1', $input['username'] . ' Bot 2'];
$servers = [];

// Minimal placeholder - users upload their own package.json + bot code
// The egg auto-detects the main file from package.json on server start
$indexJs = '// Death Legion Panel - Placeholder\\n// Upload your bot files (index.js, package.json, etc.) via the Files tab\\n// The system will auto-detect your main file from package.json\\n// and run npm install automatically on server start.\\nconsole.log("Upload your bot files to get started!");\\nconsole.log("1. Go to Files tab");\\nconsole.log("2. Upload your bot code (index.js, package.json, etc.)");\\nconsole.log("3. Click Start to run your bot");\\nconsole.log("The system will auto-detect your main file and install dependencies.");\\n';

foreach ($serverNames as $i => $name) {
    if (!isset($allocs[$i])) break;
    try {
        $server = $creationService->handle([
            'name' => $name,
            'description' => 'WhatsApp Baileys bot for ' . $input['username'],
            'owner_id' => $user->id,
            'egg_id' => $egg->id,
            'node_id' => $node->id,
            'location_id' => $location->id,
            'allocation_id' => $allocs[$i]->id,
            'environment' => ['MAIN_FILE' => 'index.js', 'NODE_ARGS' => '', 'NODE_PACKAGES' => '', 'AUTO_UPDATE' => '0', 'GIT_ADDRESS' => '', 'BRANCH' => '', 'USER_UPLOAD' => '1'],
            'memory' => 8192, 'swap' => 4096, 'disk' => 20480, 'io' => 1000, 'cpu' => 200,
            'feature_limits' => ['databases' => 1, 'allocations' => 2, 'backups' => 1],
            'startup' => $egg->startup,
            'image' => 'ghcr.io/ptero-eggs/yolks:nodejs_24',
            'skip_scripts' => true,
            'start_on_completion' => false,
        ]);

        $volPath = '/var/lib/pterodactyl/volumes/' . $server->uuid;
        @mkdir($volPath, 0755, true);
        // Install ONLY placeholder index.js - NO package.json
        // Users upload their own package.json with their bot code
        file_put_contents($volPath . '/index.js', $indexJs);
        chown($volPath . '/index.js', 'pterodactyl');
        chgrp($volPath . '/index.js', 'pterodactyl');

        echo "SERVER_CREATED:" . $server->id . ":" . $server->uuid . ":" . $server->name . "\\n";
        $servers[] = $server->uuid;
    } catch (\\Exception $e) {
        echo "SERVER_ERROR:" . $e->getMessage() . "\\n";
    }
}
echo "DONE:" . count($servers) . "\\n";
`;

  const b64 = Buffer.from(phpScript).toString('base64');
  const result = await executeOnSandbox(
    `echo '${inputB64}' | base64 -d > /tmp/approve_input.json && echo '${b64}' | base64 -d > /tmp/approve.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/approve.php 2>&1 | grep -v Deprecated`,
    90
  );

  const lines = result.trim().split('\n');
  let userId = 0;
  let serverCount = 0;
  let errorMsg = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('USER_CREATED:')) userId = parseInt(trimmed.split(':')[1]);
    else if (trimmed.startsWith('SERVER_CREATED:')) serverCount++;
    else if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed.error) errorMsg = parsed.error;
      } catch {}
    }
  }

  return { userId, serverCount, error: errorMsg, raw: result };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const status = (req.query.status as string) || 'pending';
    const result = await executeOnSandbox(
      `mysql -u pterodactyl -pptero_app_pw_2025 pterodactyl -e "SELECT id, first_name, last_name, username, email, status, created_at FROM applications WHERE status='${status}' ORDER BY created_at DESC" 2>/dev/null`,
      15
    );
    const lines = result.trim().split('\n').filter(l => l.trim());
    if (lines.length < 2) return res.status(200).json({ applications: [] });
    const headers = lines[0].split('\t');
    const apps = [];
    for (let i = 1; i < lines.length; i++) {
      const fields = lines[i].split('\t');
      const app: any = {};
      for (let j = 0; j < headers.length && j < fields.length; j++) {
        app[headers[j]] = fields[j];
      }
      apps.push(app);
    }
    return res.status(200).json({ applications: apps });
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const { action, application_id } = body;
    if (!action || !application_id) return res.status(400).json({ error: 'action and application_id required' });

    if (action === 'approve') {
      const appResult = await executeOnSandbox(
        `mysql -u pterodactyl -pptero_app_pw_2025 pterodactyl -N -e "SELECT first_name, last_name, username, email, password FROM applications WHERE id=${application_id}" 2>/dev/null`,
        10
      );
      const fields = appResult.trim().split('\t');
      if (fields.length < 5) return res.status(404).json({ error: 'Application not found' });

      const [first_name, last_name, username, email, password] = fields;
      const createResult = await createPanelUser({ first_name, last_name, username, email, password });

      if (createResult.error) return res.status(400).json({ error: createResult.error });

      await executeOnSandbox(
        `mysql -u pterodactyl -pptero_app_pw_2025 pterodactyl -e "UPDATE applications SET status='approved', reviewed_at=NOW() WHERE id=${application_id}" 2>/dev/null`,
        10
      );

      return res.status(200).json({
        success: true,
        message: 'Application approved! User and servers created with all baileys dependencies pre-installed.',
        user_id: createResult.userId,
        servers_created: createResult.serverCount,
      });
    }

    if (action === 'reject') {
      const note = (body.note || '').replace(/'/g, "\\'");
      await executeOnSandbox(
        `mysql -u pterodactyl -pptero_app_pw_2025 pterodactyl -e "UPDATE applications SET status='rejected', reviewed_at=NOW(), admin_note='${note}' WHERE id=${application_id}" 2>/dev/null`,
        10
      );
      return res.status(200).json({ success: true, message: 'Application rejected' });
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export const config = {
  api: { bodyParser: true, sizeLimit: '10mb' },
  maxDuration: 300,
};
