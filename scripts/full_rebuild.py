#!/usr/bin/env python3
"""Replace egg 1 with Node.js + create servers."""
import json, urllib.request, base64

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=60):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+10) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Read the PHP file
with open('/home/z/my-project/scripts/setup_panel.php', 'r') as f:
    setup_php = f.read()

# Also need to fix egg first - write a combined PHP file
with open('/home/z/my-project/scripts/fix_egg_and_setup.php', 'w') as f:
    f.write(setup_php)

# Transfer + run
b64 = base64.b64encode(setup_php.encode()).decode()
print("=== Running setup ===")
print(run("echo '" + b64 + "' | base64 -d > /tmp/setup.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/setup.php 2>&1 | grep -v Deprecated", timeout=120))

# Now create servers with the fixed egg
print("\n=== Create servers ===")
create_php = r"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\User;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\EggVariable;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Server;
use Pterodactyl\Services\Servers\ServerCreationService;

// First fix egg 1 - delete existing variables + replace
EggVariable::where('egg_id', 1)->delete();

$egg = Egg::find(1);
$egg->name = 'node.js generic';
$egg->description = 'Node.js egg for WhatsApp Baileys bots';
$egg->startup = 'if [ -f /home/container/package.json ]; then npm install; fi; node /home/container/index.js';
$egg->config_stop = '^C';
$egg->config_files = '{}';
$egg->config_startup = '{"done":["Server running","Connected","Bot ready"]}';
$egg->config_logs = '{}';
$egg->docker_images = ['Nodejs 24' => 'ghcr.io/ptero-eggs/yolks:nodejs_24'];
$egg->script_install = '';
$egg->script_container = 'ghcr.io/ptero-eggs/yolks:nodejs_24';
$egg->script_entry = 'bash';
$egg->save();

// Add variables
$vars = [
    ['MAIN_FILE', 'Main file', 'index.js', 'required|string'],
    ['NODE_ARGS', 'Additional Arguments', '', 'nullable|string'],
    ['NODE_PACKAGES', 'Additional Node packages', '', 'nullable|string'],
    ['AUTO_UPDATE', 'Auto Update', '0', 'required|boolean'],
    ['GIT_ADDRESS', 'Git Repo Address', '', 'nullable|string'],
    ['BRANCH', 'Install Branch', '', 'nullable|string'],
    ['USER_UPLOAD', 'User Uploaded Files', '1', 'required|boolean'],
];
foreach ($vars as $v) {
    EggVariable::create([
        'egg_id' => 1, 'name' => $v[1], 'description' => $v[1],
        'env_variable' => $v[0], 'default_value' => $v[2],
        'user_viewable' => true, 'user_editable' => true,
        'rules' => $v[3], 'field_type' => 'text',
    ]);
}
echo "Egg fixed: " . EggVariable::where('egg_id', 1)->count() . " variables\n";

// Create servers
$node = Node::first();
$location = Location::first();
$cs = app(ServerCreationService::class);

$names = ['Alpha','Beta','Gamma','Delta','Eclipse','Falcon','Ghost','Hunter','Inferno','Jaguar','Knight','Lightning','Matrix','Nova','Omega','Phantom','Quasar','Raven','Shadow','Titan'];
$idx = 0;
foreach (User::orderBy('id')->get() as $user) {
    for ($i = 0; $i < 2; $i++) {
        $a = Allocation::whereNull('server_id')->orderBy('port')->first();
        if (!$a) break 2;
        $name = 'DeathLegion ' . ($names[$idx] ?? ('Bot '.($idx+1)));
        try {
            $s = $cs->handle([
                'name'=>$name, 'description'=>'Bot for '.$user->username,
                'owner_id'=>$user->id, 'egg_id'=>1, 'node_id'=>$node->id,
                'location_id'=>$location->id, 'allocation_id'=>$a->id,
                'environment'=>['MAIN_FILE'=>'index.js','NODE_ARGS'=>'','NODE_PACKAGES'=>'','AUTO_UPDATE'=>'0','GIT_ADDRESS'=>'','BRANCH'=>'','USER_UPLOAD'=>'1'],
                'memory'=>512,'swap'=>0,'disk'=>1024,'io'=>500,'cpu'=>100,
                'feature_limits'=>['databases'=>1,'allocations'=>2,'backups'=>1],
                'startup'=>$egg->startup, 'image'=>'ghcr.io/ptero-eggs/yolks:nodejs_24',
                'skip_scripts'=>true, 'start_on_completion'=>false,
            ]);
            $v = '/var/lib/pterodactyl/volumes/'.$s->uuid;
            @mkdir($v, 0755, true);
            file_put_contents($v.'/index.js', "console.log('Upload your bot files via Files tab');\n");
            chown($v.'/index.js', 'pterodactyl'); chgrp($v.'/index.js', 'pterodactyl');
            echo "Created: {$name}\n";
            $idx++;
        } catch (\Exception $e) {
            echo "ERR: {$name}: ".substr($e->getMessage(),0,100)."\n";
        }
    }
}
echo "Total: {$idx} servers\n";
"""

b64 = base64.b64encode(create_php.encode()).decode()
print(run("echo '" + b64 + "' | base64 -d > /tmp/create.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/create.php 2>&1 | grep -v Deprecated", timeout=120))

# Start all services
print("\n=== Start services ===")
print(run("""cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan config:cache 2>&1 | tail -1
redis-server --daemonize yes 2>/dev/null
pkill -f php8.4 2>/dev/null; sleep 2
nohup php8.4 -S 0.0.0.0:8001 server.php > /tmp/php.log 2>&1 & sleep 3
sudo nginx 2>/dev/null
pkill -f wings 2>/dev/null; sleep 2
nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown
sleep 12
echo STATUS
curl -s -o /dev/null -w 'Panel: HTTP:%{http_code}' http://127.0.0.1:8000/
echo
grep -c 'finished loading' /tmp/wings.log
echo ' servers loaded'
df -h / | tail -1
""", timeout=60))

# Test via Vercel
print("\n=== Test via Vercel ===")
import subprocess
result = subprocess.run(['bash', '-c', '''
VERCEL_URL="https://deathlegionpanel.vercel.app"
curl -s -o /dev/null -w "Panel: HTTP:%{http_code}\\n" --max-time 15 "$VERCEL_URL/"
rm -f /tmp/vc.txt
curl -s -c /tmp/vc.txt -o /dev/null --max-time 15 "$VERCEL_URL/sanctum/csrf-cookie"
XSRF=$(grep XSRF-TOKEN /tmp/vc.txt | awk "{print \\$7}")
XSRF=$(python3 -c "import urllib.parse; print(urllib.parse.unquote('$XSRF'))")
curl -s -c /tmp/vc.txt -b /tmp/vc.txt --max-time 15 -X POST "$VERCEL_URL/auth/login" \\
  -H "Content-Type: application/json" -H "Accept: application/json" \\
  -H "X-XSRF-TOKEN: $XSRF" -H "X-Requested-With: XMLHttpRequest" \\
  -d '{"user":"admin","password":"DeathLegion2025!"}'
echo
curl -s --max-time 15 -b /tmp/vc.txt "$VERCEL_URL/api/client" -H "Accept: application/json" | python3 -c "import sys,json;d=json.loads(sys.stdin.read());print(f'Servers: {len(d.get(\\\"data\\\",[]))}')"
curl -s -o /dev/null -w "Apply: HTTP:%{http_code}\\n" --max-time 15 "$VERCEL_URL/apply"
curl -s -o /dev/null -w "Status: HTTP:%{http_code}\\n" --max-time 15 "$VERCEL_URL/status"
'''], capture_output=True, text=True, timeout=60)
print(result.stdout)
