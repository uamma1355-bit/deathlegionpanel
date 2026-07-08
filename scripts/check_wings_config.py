#!/usr/bin/env python3
"""Check what Wings receives from Panel - find the malformed config."""
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

# Check the server configuration structure
check_php = """<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\Server;
use Pterodactyl\\Services\\Servers\\ServerConfigurationStructureService;

$s = Server::first();
$svc = app(ServerConfigurationStructureService::class);
$cfg = $svc->handle($s);
echo json_encode($cfg, JSON_PRETTY_PRINT) . "\\n";
"""
print("=== Server config structure ===")
result = php_run(check_php, timeout=30)
print(result[:2000])
