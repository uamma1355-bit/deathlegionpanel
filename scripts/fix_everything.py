#!/usr/bin/env python3
"""Fix everything: rename servers, app name, nodejs_24, route error."""
import json, urllib.request, base64

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=120):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout+10) as r:
            return json.loads(r.read().decode()).get('result', 'no result')
    except Exception as e:
        return f'ERR: {e}'

def php_run(php_code, timeout=60):
    """Execute PHP code on the sandbox."""
    b64 = base64.b64encode(php_code.encode()).decode()
    return run("echo '" + b64 + "' | base64 -d > /tmp/exec.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/exec.php 2>&1 | grep -v Deprecated", timeout=timeout)

# ============================================================
# STEP 1: Update .env APP_NAME to "Death Legion"
# ============================================================
print("=" * 70)
print("STEP 1: Update APP_NAME to 'Death Legion'")
print("=" * 70)
print(run("cd /home/daytona/pterodactyl-panel && sed -i 's/^APP_NAME=.*/APP_NAME=Death Legion/' .env && grep '^APP_NAME=' .env"))

# ============================================================
# STEP 2: Inject beautiful font CSS
# ============================================================
print("\n" + "=" * 70)
print("STEP 2: Inject Death Legion beautiful font CSS")
print("=" * 70)

custom_css = """/* Death Legion custom font and branding */
@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=Inter:wght@300;400;500;600;700&display=swap');

:root {
    --dl-font: 'Cinzel', 'Inter', -apple-system, sans-serif;
    --dl-primary: #bc6e3c;
    --dl-accent: #e89060;
}

/* Apply beautiful font to all headings and brand */
h1, h2, h3, h4, h5, h6,
.navbar-brand, .logo, .brand-name,
.sidebar-brand, .main-header .logo,
.login-box .login-logo, .auth-box h1,
#app header, .nav-brand {
    font-family: var(--dl-font) !important;
    letter-spacing: 0.05em;
}

/* Death Legion gradient text */
.brand-text, .app-name, .navbar-brand {
    background: linear-gradient(135deg, #bc6e3c 0%, #e89060 50%, #bc6e3c 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
}

/* Login page title - big and beautiful */
.login-box .login-logo, .auth-container h1 {
    font-family: var(--dl-font) !important;
    font-weight: 900;
    font-size: 2.5rem;
    background: linear-gradient(135deg, #bc6e3c 0%, #e89060 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    text-align: center;
    margin-bottom: 1rem;
}
"""

css_b64 = base64.b64encode(custom_css.encode()).decode()
print(run("echo '" + css_b64 + "' | base64 -d > /home/daytona/pterodactyl-panel/public/assets/deathlegion.css && echo 'CSS written'"))

# Inject CSS link into all blade layouts with </head>
print(run("for f in $(find /home/daytona/pterodactyl-panel/resources/views -name '*.blade.php' -exec grep -l '</head>' {} \\;); do grep -q 'deathlegion.css' \"$f\" || sed -i 's|</head>|<link rel=\"stylesheet\" href=\"/assets/deathlegion.css?v=2\"></head>|' \"$f\"; done && echo 'CSS injected into blade templates' && find /home/daytona/pterodactyl-panel/resources/views -name '*.blade.php' -exec grep -l 'deathlegion.css' {} \\; | head -5"))

# ============================================================
# STEP 3: Update egg + all servers to Node.js 24
# ============================================================
print("\n" + "=" * 70)
print("STEP 3: Update egg + all servers to Node.js 24")
print("=" * 70)

update_php = """<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\Egg;
use Pterodactyl\\Models\\Server;

$egg = Egg::find(1);
$egg->docker_images = [
    'Nodejs 24' => 'ghcr.io/ptero-eggs/yolks:nodejs_24',
    'Nodejs 22' => 'ghcr.io/ptero-eggs/yolks:nodejs_22',
    'Nodejs 20' => 'ghcr.io/ptero-eggs/yolks:nodejs_20',
];
$egg->save();
echo "Egg images updated (default: Nodejs 24)\\n";

$count = 0;
foreach (Server::all() as $s) {
    $s->image = 'ghcr.io/ptero-eggs/yolks:nodejs_24';
    $s->save();
    $count++;
}
echo "Updated {$count} servers to nodejs_24\\n";
"""
print(php_run(update_php, timeout=45))

# ============================================================
# STEP 4: Rename all 20 servers to DeathLegion-themed names
# ============================================================
print("\n" + "=" * 70)
print("STEP 4: Rename all servers to DeathLegion-themed names")
print("=" * 70)

rename_php = """<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\Server;
use Pterodactyl\\Models\\User;

$botNames = [
    'DeathLegion Alpha', 'DeathLegion Beta', 'DeathLegion Gamma', 'DeathLegion Delta',
    'DeathLegion Eclipse', 'DeathLegion Falcon', 'DeathLegion Ghost', 'DeathLegion Hunter',
    'DeathLegion Inferno', 'DeathLegion Jaguar', 'DeathLegion Knight', 'DeathLegion Lightning',
    'DeathLegion Matrix', 'DeathLegion Nova', 'DeathLegion Omega', 'DeathLegion Phantom',
    'DeathLegion Quasar', 'DeathLegion Raven', 'DeathLegion Shadow', 'DeathLegion Titan',
];

$idx = 0;
foreach (User::orderBy('id')->get() as $user) {
    $servers = Server::where('owner_id', $user->id)->orderBy('id')->get();
    foreach ($servers as $s) {
        $newName = $botNames[$idx] ?? ('DeathLegion Bot ' . ($idx + 1));
        $oldName = $s->name;
        $s->name = $newName;
        $s->description = $newName . ' - WhatsApp Baileys bot for ' . $user->username;
        $s->save();
        echo "User {$user->username}: '{$oldName}' -> '{$newName}'\\n";
        $idx++;
    }
}
echo "\\nTotal renamed: {$idx}\\n";
"""
print(php_run(rename_php, timeout=45))

# ============================================================
# STEP 5: Clear cache + restart Wings
# ============================================================
print("\n" + "=" * 70)
print("STEP 5: Clear cache + restart Wings")
print("=" * 70)
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan cache:clear 2>&1 | tail -1 && php artisan view:clear 2>&1 | tail -1"))
print(run("sudo docker ps -aq | xargs -r sudo docker rm -f 2>&1 | tail -3; pkill -f 'wings --config' 2>/dev/null; sleep 3; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 12; echo restarted; grep -c 'finished loading configuration' /tmp/wings.log", timeout=30))

# ============================================================
# STEP 6: Verify
# ============================================================
print("\n" + "=" * 70)
print("STEP 6: Verify")
print("=" * 70)

verify_php = """<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();

use Pterodactyl\\Models\\Server;
use Pterodactyl\\Models\\Egg;

echo "App name: " . config('app.name') . "\\n";
echo "Egg images: " . json_encode(Egg::find(1)->docker_images) . "\\n";
echo "\\nAll servers:\\n";
foreach (Server::orderBy('id')->get() as $s) {
    echo "  #{$s->id}: {$s->name} | image=" . $s->image . "\\n";
}
"""
print(php_run(verify_php, timeout=30))
