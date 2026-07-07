#!/usr/bin/env python3
"""Fix APP_NAME quoting + verify everything."""
import json, urllib.request, base64

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=30):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Use Python on the sandbox to fix .env properly
fix_env_py = """
import re
path = '/home/z/my-project/.env'
with open(path, 'r') as f:
    content = f.read()

# Replace APP_NAME with quoted value
if 'APP_NAME=' in content:
    content = re.sub(r'^APP_NAME=.*$', 'APP_NAME=\"Death Legion\"', content, flags=re.MULTILINE)
else:
    content = 'APP_NAME=\"Death Legion\"\\n' + content

with open(path, 'w') as f:
    f.write(content)
print('Fixed .env APP_NAME')

# Verify
with open(path, 'r') as f:
    for line in f:
        if line.startswith('APP_NAME'):
            print('Current:', line.strip())
            break
"""

fix_b64 = base64.b64encode(fix_env_py.encode()).decode()
print("=== Fix .env APP_NAME ===")
print(run("echo '" + fix_b64 + "' | base64 -d > /tmp/fix_env.py && python3 /tmp/fix_env.py"))

# Rebuild config cache
print("\n=== Rebuild config cache ===")
print(run("cd /home/daytona/pterodactyl-panel && php artisan config:clear 2>&1 | tail -1 && php artisan config:cache 2>&1 | tail -1"))

# Verify with PHP file
verify_php = """<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
echo 'APP_NAME: ' . config('app.name') . \"\\n\";
echo 'APP_URL: ' . config('app.url') . \"\\n\";
"""
verify_b64 = base64.b64encode(verify_php.encode()).decode()
print("\n=== Verify APP_NAME ===")
print(run("echo '" + verify_b64 + "' | base64 -d > /tmp/verify_app.php && cd /home/daytona/pterodactyl-panel && php /tmp/verify_app.php 2>&1 | grep -v Deprecated"))

# Restart PHP server to pick up new config
print("\n=== Restart PHP server ===")
print(run("pkill -f 'php8.4 -S' 2>/dev/null; sleep 2; cd /home/daytona/pterodactyl-panel && nohup php8.4 -S 0.0.0.0:8001 /home/daytona/pterodactyl-panel/server.php > /tmp/php-server.log 2>&1 & disown; sleep 3; echo 'PHP restarted'"))

# Test panel HTML
print("\n=== Test panel HTML for app name ===")
print(run("curl -s http://127.0.0.1:8000/ 2>&1 | grep -o 'Death Legion\\|Pterodactyl\\|SiteConfiguration' | head -5"))

# Check the SiteConfiguration JSON in the HTML
print("\n=== Check SiteConfiguration in HTML ===")
print(run("curl -s http://127.0.0.1:8000/ 2>&1 | grep -o 'SiteConfiguration.*' | head -1"))
