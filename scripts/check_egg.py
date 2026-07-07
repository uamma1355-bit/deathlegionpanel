#!/usr/bin/env python3
"""Check egg config."""
import json, urllib.request

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=30):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Write the PHP script via base64
php_code = '''<?php
require "/home/daytona/pterodactyl-panel/vendor/autoload.php";
$app = require "/home/daytona/pterodactyl-panel/bootstrap/app.php";
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\Egg;
use Pterodactyl\\Models\\Server;

$e = Egg::find(1);
echo "Egg name: " . $e->name . "\\n";
echo "Egg startup: " . $e->startup . "\\n";
echo "Docker images: " . json_encode($e->docker_images) . "\\n";
echo "\\nServers:\\n";
foreach (Server::all() as $s) {
    echo "  " . $s->name . ": image=" . $s->image . "\\n";
}
'''

import base64
b64 = base64.b64encode(php_code.encode()).decode()
print(run("echo '" + b64 + "' | base64 -d > /tmp/check_egg.php && cd /home/daytona/pterodactyl-panel && php /tmp/check_egg.php 2>&1 | grep -v Deprecated", timeout=30))
