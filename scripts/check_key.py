import json, urllib.request, base64

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = f'https://app.daytona.io/api/toolbox/{SANDBOX_ID}/toolbox/process/execute'

def run(cmd, timeout=30):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={'Authorization': f'Bearer {DAYTONA_TOKEN}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Check API key + user via PHP script
php = b"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\ApiKey;

$k = ApiKey::where('identifier', '735E96098E5297C3')->first();
echo "Key found: " . ($k ? "YES" : "NO") . "\\n";
if ($k) {
    echo "key_type: {$k->key_type}\\n";
    echo "user_id: {$k->user_id}\\n";
    echo "user root_admin: " . ($k->user->root_admin ? "YES" : "NO") . "\\n";
    try {
        $dec = decrypt($k->getRawOriginal('token'));
        echo "token decrypt: OK (len=" . strlen($dec) . ")\\n";
    } catch (\\Exception $e) {
        echo "token decrypt: FAILED: " . $e->getMessage() . "\\n";
    }
    echo "r_users: {$k->r_users}\\n";
    echo "r_servers: {$k->r_servers}\\n";
    
    // Check TYPE_APPLICATION constant
    echo "\\nTYPE_APPLICATION = " . ApiKey::TYPE_APPLICATION . "\\n";
    echo "TYPE_ACCOUNT = " . ApiKey::TYPE_ACCOUNT . "\\n";
    echo "TYPE_NONE = " . ApiKey::TYPE_NONE . "\\n";
}
"""
b64 = base64.b64encode(php).decode()
print(run(f'echo {b64} | base64 -d > /tmp/check_key.php && cd /home/daytona/pterodactyl-panel && php /tmp/check_key.php 2>&1 | grep -v Deprecated'))
