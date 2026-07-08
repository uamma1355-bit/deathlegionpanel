#!/usr/bin/env python3
"""Check + fix egg config_startup field (the { character issue)."""
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

# Check egg config fields
check_php = """<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\Egg;

$e = Egg::find(1);
echo "config_startup: " . $e->config_startup . "\\n";
echo "config_files: " . $e->config_files . "\\n";
echo "config_logs: " . $e->config_logs . "\\n";
echo "config_stop: " . $e->config_stop . "\\n";

// Fix config_startup to valid JSON
$e->config_startup = json_encode(["done" => ["Server running", "Connected", "Bot ready", "started"]]);
$e->config_files = '{}';
$e->config_logs = '{}';
$e->config_stop = '^C';
$e->save();
echo "\\nFixed egg config\\n";
echo "new config_startup: " . $e->config_startup . "\\n";
"""
print("=== Check + fix egg config ===")
print(php_run(check_php, timeout=30))

# Clear cache + restart Wings
print("\n=== Clear cache + restart Wings ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1", timeout=20))
print(run("pkill -f 'wings --config' 2>/dev/null; sleep 3; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 10; grep -c 'finished loading' /tmp/wings.log; echo 'loaded'; grep -c 'failed to load' /tmp/wings.log; echo 'failed'", timeout=25))

# Test WS
print("\n=== Test WS ===")
print(run("curl -s -o /dev/null -w 'WS: HTTP:%{http_code}' --max-time 5 -H 'Upgrade: websocket' -H 'Connection: Upgrade' -H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' http://127.0.0.1:8080/api/servers/29ea72ef-8dc9-416c-8db6-29699975a532/ws", timeout=10))
