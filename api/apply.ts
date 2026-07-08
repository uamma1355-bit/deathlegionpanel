import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

const INDEX_JS = `console.log("Bot starting...");\nconsole.log("Connected");\nconsole.log("Bot ready");\nsetInterval(() => { console.log("Bot alive at " + new Date().toISOString()); }, 60000);\n`;

const PACKAGE_JSON = '{"name":"deathlegion-bot","version":"1.0.0","main":"index.js","scripts":{"start":"node index.js"},"dependencies":{}}';

async function executeOnSandbox(command: string, timeout: number = 30): Promise<string> {
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
    if (password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });

    // Build PHP script - write values to a JSON file first, then read in PHP
    const inputData = JSON.stringify({ first_name, last_name, username, email, password });
    const inputB64 = Buffer.from(inputData).toString('base64');

    const phpScript = `<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\User;
use Pterodactyl\\Models\\Server;
use Pterodactyl\\Models\\Egg;
use Pterodactyl\\Models\\Node;
use Pterodactyl\\Models\\Allocation;
use Pterodactyl\\Models\\Location;
use Pterodactyl\\Services\\Servers\\ServerCreationService;

// Read input data from JSON file
$input = json_decode(file_get_contents('/tmp/apply_input.json'), true);

$existing = User::where('username', $input['username'])->orWhere('email', $input['email'])->first();
if ($existing) {
    echo json_encode(['error' => 'Username or email already exists']);
    exit;
}

// Create user using the UserCreationService (handles uuid + validation)
$userService = app(\\Pterodactyl\\Services\\Users\\UserCreationService::class);
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

// Get available allocations
$allocs = Allocation::whereNull('server_id')->orderBy('port')->limit(2)->get();
echo "ALLOCATIONS:" . $allocs->count() . "\\n";

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
        
        // Install bot files
        $volPath = '/var/lib/pterodactyl/volumes/' . $server->uuid;
        @mkdir($volPath, 0755, true);
        file_put_contents($volPath . '/index.js', file_get_contents('/home/daytona/bot-template.js'));
        file_put_contents($volPath . '/package.json', file_get_contents('/home/daytona/bot-template.json'));
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
    
    // Write bot template files
    const indexB64 = Buffer.from(INDEX_JS).toString('base64');
    const pkgB64 = Buffer.from(PACKAGE_JSON).toString('base64');
    await executeOnSandbox(`echo '${indexB64}' | base64 -d > /home/daytona/bot-template.js && echo '${pkgB64}' | base64 -d > /home/daytona/bot-template.json`, 10);
    
    // Write input JSON + PHP script, then execute
    const result = await executeOnSandbox(
      `echo '${inputB64}' | base64 -d > /tmp/apply_input.json && echo '${b64}' | base64 -d > /tmp/apply.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/apply.php 2>&1 | grep -v Deprecated`,
      60
    );
    
    // Parse result
    const lines = result.trim().split('\n');
    let userId = 0;
    let serverUuids: string[] = [];
    let errorMsg = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('USER_CREATED:')) userId = parseInt(trimmed.split(':')[1]);
      else if (trimmed.startsWith('SERVER_CREATED:')) {
        const parts = trimmed.split(':');
        serverUuids.push(parts[2]);
      }
      else if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed.error) errorMsg = parsed.error;
        } catch {}
      }
    }
    
    if (errorMsg) return res.status(400).json({ error: errorMsg });
    if (userId === 0) return res.status(500).json({ error: 'Failed to create user', detail: result });

    return res.status(200).json({
      success: true,
      message: 'Account and servers created successfully!',
      user: { id: userId, username, email, first_name, last_name },
      servers: serverUuids.map((uuid, i) => ({ uuid, name: `${username} Bot ${i+1}` })),
      login: { username, password },
    });
  } catch (err) {
    console.error('Apply error:', err);
    return res.status(500).json({ error: 'Failed', detail: err instanceof Error ? err.message : String(err) });
  }
}

export const config = {
  api: { bodyParser: true, sizeLimit: '10mb' },
  maxDuration: 300,
};
