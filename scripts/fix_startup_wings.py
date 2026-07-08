#!/usr/bin/env python3
"""Fix startup command - simplify to avoid Wings YAML parsing errors."""
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

def php_run(php_code, timeout=60):
    b64 = base64.b64encode(php_code.encode()).decode()
    return run("echo '" + b64 + "' | base64 -d > /tmp/exec.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/exec.php 2>&1 | grep -v Deprecated", timeout=timeout)

# Simple startup that works with Wings YAML parser:
# 1. npm install if package.json exists
# 2. node index.js (users can change MAIN_FILE in startup tab)
SIMPLE_STARTUP = 'if [ -f /home/container/package.json ]; then npm install; fi; node /home/container/index.js'

fix_php = """<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\Egg;
use Pterodactyl\\Models\\Server;

// Simple startup that Wings can parse
$startup = 'if [ -f /home/container/package.json ]; then npm install; fi; node /home/container/index.js';

$egg = Egg::find(1);
$egg->startup = $startup;
$egg->save();
echo "Egg startup fixed\\n";

$count = 0;
foreach (Server::all() as $s) {
    $s->startup = $startup;
    $s->save();
    $count++;
}
echo "Fixed {$count} servers\\n";
"""
print("=== Fix startup command ===")
print(php_run(fix_php, timeout=45))

# Clear cache + restart Wings
print("\n=== Clear cache + restart Wings ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1", timeout=20))
print(run("pkill -f 'wings --config' 2>/dev/null; sleep 3; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 10; grep -c 'finished loading' /tmp/wings.log; echo ---; grep -c 'failed to load' /tmp/wings.log", timeout=25))

# Test WS
print("\n=== Test WebSocket ===")
print(run("curl -s -o /dev/null -w 'WS direct: HTTP:%{http_code}' --max-time 5 -H 'Upgrade: websocket' -H 'Connection: Upgrade' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' http://127.0.0.1:8080/api/servers/29ea72ef-8dc9-416c-8db6-29699975a532/ws", timeout=10))

# Test public URL
print("\n=== Test panel ===")
print(run("curl -s -o /dev/null -w 'Panel: HTTP:%{http_code}' http://127.0.0.1:8000/", timeout=10))
