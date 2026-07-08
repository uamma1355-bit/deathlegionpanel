import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
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

async function createPanelUser(data: { username: string; email: string; first_name: string; last_name: string; password: string }) {
  const inputJson = JSON.stringify(data);
  const inputB64 = Buffer.from(inputJson).toString('base64');

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
            'environment' => [
                'MAIN_FILE' => 'index.js',
                'NODE_ARGS' => '',
                'NODE_PACKAGES' => '',
                'AUTO_UPDATE' => '0',
                'GIT_ADDRESS' => '',
                'BRANCH' => '',
                'USER_UPLOAD' => '1',
            ],
            'memory' => 8192,
            'swap' => 4096,
            'disk' => 20480,
            'io' => 1000,
            'cpu' => 200,
            'feature_limits' => ['databases' => 1, 'allocations' => 2, 'backups' => 1],
            'startup' => $egg->startup,
            'image' => 'ghcr.io/ptero-eggs/yolks:nodejs_24',
            'skip_scripts' => true,
            'start_on_completion' => false,
        ]);

        // Install bot files with baileys pre-installed
        $volPath = '/var/lib/pterodactyl/volumes/' . $server->uuid;
        @mkdir($volPath, 0755, true);

        // index.js with baileys template
        $indexJs = 'console.log("Bot starting...");\\nconsole.log("Connected");\\nconsole.log("Bot ready");\\nsetInterval(() => { console.log("Bot alive at " + new Date().toISOString()); }, 60000);\\n';
        file_put_contents($volPath . '/index.js', $indexJs);

        // package.json WITH baileys pre-listed
        $pkgJson = json_encode([
            'name' => 'deathlegion-bot',
            'version' => '1.0.0',
            'main' => 'index.js',
            'scripts' => ['start' => 'node index.js'],
            'dependencies' => ['@whiskeysockets/baileys' => '^6.7.0', 'qrcode-terminal' => '^0.12.0', 'pino' => '^8.0.0'],
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        file_put_contents($volPath . '/package.json', $pkgJson);

        chown($volPath . '/index.js', 'pterodactyl');
        chgrp($volPath . '/index.js', 'pterodactyl');
        chown($volPath . '/package.json', 'pterodactyl');
        chgrp($volPath . '/package.json', 'pterodactyl');

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

  // GET: List applications
  if (req.method === 'GET') {
    const status = (req.query.status as string) || 'pending';
    const result = await executeOnSandbox(
      `mysql -u pterodactyl -pptero_app_pw_2025 pterodactyl -e "SELECT id, first_name, last_name, username, email, status, created_at FROM applications WHERE status='${status}' ORDER BY created_at DESC" 2>/dev/null`,
      15
    );

    // Parse MySQL output to JSON
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

  // POST: Approve or reject
  if (req.method === 'POST') {
    const body = req.body || {};
    const { action, application_id } = body;

    if (!action || !application_id) {
      return res.status(400).json({ error: 'action and application_id required' });
    }

    if (action === 'approve') {
      // Get application data
      const appResult = await executeOnSandbox(
        `mysql -u pterodactyl -pptero_app_pw_2025 pterodactyl -N -e "SELECT first_name, last_name, username, email, password FROM applications WHERE id=${application_id}" 2>/dev/null`,
        10
      );

      const fields = appResult.trim().split('\t');
      if (fields.length < 5) {
        return res.status(404).json({ error: 'Application not found' });
      }

      const [first_name, last_name, username, email, password] = fields;

      // Create user + servers
      const createResult = await createPanelUser({ first_name, last_name, username, email, password });

      if (createResult.error) {
        return res.status(400).json({ error: createResult.error });
      }

      // Update application status
      await executeOnSandbox(
        `mysql -u pterodactyl -pptero_app_pw_2025 pterodactyl -e "UPDATE applications SET status='approved', reviewed_at=NOW() WHERE id=${application_id}" 2>/dev/null`,
        10
      );

      return res.status(200).json({
        success: true,
        message: 'Application approved! User and servers created.',
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

    return res.status(400).json({ error: 'Invalid action. Use approve or reject.' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

export const config = {
  api: { bodyParser: true, sizeLimit: '10mb' },
  maxDuration: 300,
};
