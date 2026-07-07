#!/usr/bin/env python3
"""
Deploy the FULL official Pterodactyl Panel (no changes) on the Daytona sandbox.
This replaces the trimmed backend with the complete upstream panel.
"""
import json
import urllib.request
import base64
import subprocess
import os
from pathlib import Path

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"
DAYTONA_API = "https://app.daytona.io/api"

def exec_cmd(command, timeout=300):
    body = json.dumps({
        "command": command,
        "cwd": "/home/daytona",
        "timeout": timeout,
    })
    req = urllib.request.Request(
        f"{DAYTONA_API}/toolbox/{SANDBOX}/toolbox/process/execute",
        data=body.encode(),
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout + 30) as resp:
        data = json.loads(resp.read())
        return data.get("exitCode", -1), data.get("result", "")


def main():
    print("=== Deploying FULL official Pterodactyl Panel ===")
    
    # Step 1: Clone the official repo
    print("\n1. Cloning official Pterodactyl Panel v1.11.3...")
    code, out = exec_cmd(
        "cd /home/daytona && rm -rf pterodactyl-full && "
        "git clone --depth=1 --branch v1.11.3 https://github.com/pterodactyl/panel.git pterodactyl-full 2>&1 | tail -3 && "
        "echo CLONE_OK",
        timeout=120,
    )
    print(f"  {out[-100:]}")
    
    # Step 2: Install composer dependencies
    print("\n2. Installing composer dependencies...")
    code, out = exec_cmd(
        "cd /home/daytona/pterodactyl-full && composer install --no-dev --optimize-autoloader --no-interaction 2>&1 | tail -5 && echo COMPOSER_OK",
        timeout=600,
    )
    print(f"  {out[-200:]}")
    
    # Step 3: Configure .env
    print("\n3. Configuring .env...")
    code, out = exec_cmd(
        "cd /home/daytona/pterodactyl-full && cp .env.example .env && "
        "KEY=$(php -r 'echo base64_encode(random_bytes(32));') && "
        f"sed -i 's|^APP_KEY=.*|APP_KEY=base64:$KEY|' .env && "
        "sed -i 's|^APP_ENV=.*|APP_ENV=local|' .env && "
        "sed -i 's|^APP_DEBUG=.*|APP_DEBUG=true|' .env && "
        "sed -i 's|^APP_URL=.*|APP_URL=http://localhost:8000|' .env && "
        "sed -i 's|^DB_HOST=.*|DB_HOST=127.0.0.1|' .env && "
        "sed -i 's|^DB_DATABASE=.*|DB_DATABASE=pterodactyl|' .env && "
        "sed -i 's|^DB_USERNAME=.*|DB_USERNAME=pterodactyl|' .env && "
        "sed -i 's|^DB_PASSWORD=.*|DB_PASSWORD=ptero_app_pw_2025|' .env && "
        "sed -i 's|^REDIS_HOST=.*|REDIS_HOST=127.0.0.1|' .env && "
        "sed -i 's|^CACHE_DRIVER=.*|CACHE_DRIVER=redis|' .env && "
        "sed -i 's|^SESSION_DRIVER=.*|SESSION_DRIVER=redis|' .env && "
        "sed -i 's|^QUEUE_CONNECTION=.*|QUEUE_CONNECTION=redis|' .env && "
        "sed -i 's|^MAIL_MAILER=.*|MAIL_MAILER=log|' .env && "
        "sed -i 's|^RECAPTCHA_ENABLED=.*|RECAPTCHA_ENABLED=false|' .env && "
        "echo ENV_OK",
        timeout=30,
    )
    print(f"  {out[-100:]}")
    
    # Step 4: Migrate + seed
    print("\n4. Running migrations...")
    code, out = exec_cmd(
        "cd /home/daytona/pterodactyl-full && php artisan migrate --force --seed 2>&1 | tail -5 && echo MIGRATE_OK",
        timeout=180,
    )
    print(f"  {out[-200:]}")
    
    # Step 5: Create admin user
    print("\n5. Creating admin user...")
    code, out = exec_cmd(
        "cd /home/daytona/pterodactyl-full && php artisan p:user:make "
        "--email admin@deathlegion.local --username admin "
        "--name-first Admin --name-last User "
        "--password 'DeathLegion2025!' --admin 1 2>&1 | tail -5",
        timeout=30,
    )
    print(f"  {out[-200:]}")
    
    # Step 6: Configure node for localhost
    print("\n6. Configuring node + Wings...")
    SCRIPT = r'''
<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\Node;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Models\Egg;
use Pterodactyl\Models\Nest;
use Illuminate\Support\Str;

// Create location
$loc = Location::firstOrCreate(["short" => "local"], ["long" => "Local"]);

// Create node
$node = Node::firstOrCreate(
    ["fqdn" => "localhost"],
    [
        "uuid" => Str::uuid(),
        "public" => true,
        "name" => "Local Node",
        "location_id" => $loc->id,
        "scheme" => "http",
        "behind_proxy" => false,
        "memory" => 2048,
        "memory_overallocate" => 0,
        "disk" => 10240,
        "disk_overallocate" => 0,
        "upload_size" => 100,
        "daemonBase" => "/var/lib/pterodactyl/volumes",
        "daemonSFTP" => 2022,
        "daemonListen" => 8080,
        "daemon_token" => encrypt(Str::random(64)),
        "daemon_token_id" => Str::random(16),
        "maintenance_mode" => false,
    ]
);

// Create allocations
for ($port = 25565; $port <= 25580; $port++) {
    Allocation::firstOrCreate(["node_id" => $node->id, "ip" => "0.0.0.0", "port" => $port]);
}

// Create Generic nest + Node.js egg
$nest = Nest::firstOrCreate(
    ["name" => "Generic"],
    ["uuid" => Str::uuid(), "author" => "system", "description" => "Generic servers"]
);

$egg = Egg::firstOrCreate(
    ["nest_id" => $nest->id, "name" => "Node.js"],
    [
        "uuid" => Str::uuid(),
        "author" => "system",
        "description" => "Node.js server",
        "docker_images" => json_encode(["node_18" => "ghcr.io/pterodactyl/yolks:node_18"]),
        "startup" => "if [ -f package.json ]; then npm install && npm start; else node index.js; fi",
        "config_files" => "{}",
        "config_startup" => json_encode(["done" => "Server started"]),
        "config_logs" => json_encode(["custom" => false, "location" => "logs/latest.log"]),
        "config_stop" => "SIGKILL",
        "script_install" => "#!/bin/bash\necho install",
        "script_entry" => "bash",
        "script_container" => "ghcr.io/pterodactyl/installers:alpine",
    ]
);

// Write Wings config
$token = decrypt($node->getAttributes()["daemon_token"]);
$tokenId = $node->daemon_token_id;
$config = "debug: false\napi:\n  host: 127.0.0.1\n  port: 8080\n  ssl:\n    enabled: false\nsystem:\n  data: /var/lib/pterodactyl/volumes\n  sftp:\n    bind_port: 2022\n  user:\n    root: true\nremote: http://127.0.0.1:8000\ntoken_id: \"$tokenId\"\ntoken: \"$token\"\n";
file_put_contents("/tmp/wings_config.yml", $config);
echo "NODE_ID:{$node->id}\n";
echo "TOKEN_ID:{$tokenId}\n";
echo "WINGS_CONFIG_WRITTEN\n";
echo "DONE\n";
'''
    b64 = base64.b64encode(SCRIPT.encode()).decode()
    code, out = exec_cmd(
        f"printf '%s' '{b64}' | base64 -d > /home/daytona/pterodactyl-full/setupnode.php && "
        "cd /home/daytona/pterodactyl-full && php setupnode.php 2>&1; rm setupnode.php && "
        "sudo cp /tmp/wings_config.yml /etc/pterodactyl/config.yml && echo CONFIG_INSTALLED",
        timeout=30,
    )
    print(f"  {out[-200:]}")
    
    # Step 7: Start the panel
    print("\n7. Starting panel...")
    code, out = exec_cmd(
        "cd /home/daytona/pterodactyl-full && "
        "php artisan config:cache 2>&1 | tail -1 && "
        "php artisan route:cache 2>&1 | tail -1 && "
        "php artisan view:cache 2>&1 | tail -1 && "
        "php artisan optimize 2>&1 | tail -1 && "
        "mkdir -p storage/framework/views storage/framework/sessions storage/framework/cache && "
        "chmod -R 775 storage bootstrap/cache && "
        "sudo pkill -9 -f 'artisan serve' 2>/dev/null; sleep 2 && "
        "setsid nohup php artisan serve --host=0.0.0.0 --port=8000 --no-interaction > storage/logs/server.log 2>&1 < /dev/null & disown && "
        "sleep 4 && "
        "curl -s -o /dev/null -w PANEL=%{http_code} http://127.0.0.1:8000/; echo && "
        "curl -s -o /dev/null -w ADMIN=%{http_code} http://127.0.0.1:8000/admin; echo",
        timeout=30,
    )
    print(f"  {out[-200:]}")
    
    # Step 8: Start Wings
    print("\n8. Starting Wings...")
    code, out = exec_cmd(
        "sudo pkill -9 -f wings 2>/dev/null; sleep 2 && "
        "sudo setsid nohup /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 < /dev/null & disown && "
        "sleep 5 && "
        "curl -s -o /dev/null -w WINGS=%{http_code} http://127.0.0.1:8080/api/system; echo",
        timeout=30,
    )
    print(f"  {out[-100:]}")
    
    # Step 9: Verify everything
    print("\n9. Verification...")
    code, out = exec_cmd(
        "echo '=== Panel ===' && "
        "curl -s -o /dev/null -w 'PANEL=%{http_code}' http://127.0.0.1:8000/; echo && "
        "curl -s -o /dev/null -w 'ADMIN=%{http_code}' http://127.0.0.1:8000/admin; echo && "
        "curl -s -o /dev/null -w 'LOGIN=%{http_code}' http://127.0.0.1:8000/auth/login; echo && "
        "echo '=== Wings ===' && "
        "curl -s -o /dev/null -w 'WINGS=%{http_code}' http://127.0.0.1:8080/api/system; echo && "
        "echo '=== API ===' && "
        "curl -s -o /dev/null -w 'API=%{http_code}' http://127.0.0.1:8000/api/client/account; echo && "
        "echo '=== Files ===' && "
        "ls /home/daytona/pterodactyl-full/resources/scripts/components/ | head -10 && "
        "echo '=== DONE ==='",
        timeout=15,
    )
    print(out)
    
    print("\n=== FULL PTERODACTYL PANEL DEPLOYED ===")
    print(f"  Panel URL: https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu")
    print(f"  Admin URL: https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/admin")
    print(f"  Login URL: https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu/auth/login")
    print(f"  Login: admin / DeathLegion2025!")


if __name__ == "__main__":
    main()
