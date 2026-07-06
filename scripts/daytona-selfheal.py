#!/usr/bin/env python3
"""
Daytona self-healing system.

This script runs on GitHub Actions every 5 minutes. It:

1. Checks if the backend sandbox is alive (ping /api/client/permissions)
2. If ALIVE: triggers a MySQL backup (dump → compress → commit to GitHub repo)
3. If DEAD: creates a new sandbox, restores MySQL from the latest backup,
   reinstalls the backend, updates Vercel env, and redeploys the frontend

Data persistence: MySQL dumps are stored as `backups/latest.sql.gz.b64` in
the GitHub repo. When a sandbox dies and a new one is created, the latest
dump is imported — zero data loss (admin users, eggs, nodes, servers all
preserved).

Usage (GitHub Actions):
    python3 scripts/daytona-selfheal.py

Required env vars:
    DAYTONA_TOKEN         - Daytona API token
    DAYTONA_SANDBOX_NAME  - name of the backend sandbox (default: pterodactyl-backend)
    GH_TOKEN              - GitHub token with repo write access
    GH_REPO               - owner/repo (e.g. deathlegion/deathlegionpanel)
    VERCEL_TOKEN          - Vercel token for updating VITE_API_URL
    VERCEL_PROJECT_ID     - Vercel project ID
    VERCEL_ORG_ID         - Vercel org/team ID
    MYSQL_ROOT_PW         - MySQL root password (must be same across recreations)
    MYSQL_APP_PW          - MySQL app password (must be same across recreations)
    ADMIN_EMAIL           - Admin email (for re-creating if missing)
    ADMIN_USERNAME        - Admin username
    ADMIN_PASSWORD        - Admin password
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path

# --- Configuration ---
DAYTONA_TOKEN = os.environ.get("DAYTONA_TOKEN", "<DAYTONA_TOKEN>")
SANDBOX_NAME = os.environ.get("DAYTONA_SANDBOX_NAME", "pterodactyl-backend")
DAYTONA_API = "https://app.daytona.io/api"
SNAPSHOT = "daytonaio/sandbox:0.8.0"
REGION = "eu"

GH_TOKEN = os.environ.get("GH_TOKEN", "")
GH_REPO = os.environ.get("GH_REPO", "")
BACKUP_FILE = "backups/latest.sql.gz.b64"

VERCEL_TOKEN = os.environ.get("VERCEL_TOKEN", "<VERCEL_TOKEN>")
VERCEL_ORG_ID = os.environ.get("VERCEL_ORG_ID", "")
VERCEL_PROJECT_ID = os.environ.get("VERCEL_PROJECT_ID", "")

MYSQL_ROOT_PW = os.environ.get("MYSQL_ROOT_PW", "<MYSQL_ROOT_PW>")
MYSQL_APP_PW = os.environ.get("MYSQL_APP_PW", "<MYSQL_APP_PW>")
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@deathlegion.local")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "<ADMIN_PASSWORD>")

REPO_ROOT = Path(__file__).resolve().parent.parent


# --- Daytona API helpers ---

def api_get(path: str) -> dict:
    req = urllib.request.Request(
        f"{DAYTONA_API}{path}",
        headers={"Authorization": f"Bearer {DAYTONA_TOKEN}"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def api_post(path: str, body: dict, timeout: int = 30) -> dict:
    req = urllib.request.Request(
        f"{DAYTONA_API}{path}",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {DAYTONA_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def api_delete(path: str) -> dict:
    req = urllib.request.Request(
        f"{DAYTONA_API}{path}",
        headers={"Authorization": f"Bearer {DAYTONA_TOKEN}"},
        method="DELETE",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def exec_cmd(sandbox_id: str, command: str, timeout: int = 60) -> tuple[int, str]:
    try:
        result = api_post(
            f"/toolbox/{sandbox_id}/toolbox/process/execute",
            {"command": command, "cwd": "/home/daytona", "timeout": timeout},
            timeout=timeout + 10,
        )
        return int(result.get("exitCode", -1)), result.get("result", "")
    except Exception as e:
        return -1, str(e)


def find_sandbox(name: str) -> dict | None:
    data = api_get("/sandbox")
    for sb in data.get("items", []):
        if sb["name"] == name:
            return sb
    return None


def get_preview_url(sandbox_id: str, port: int = 8000) -> str:
    """Get the permanent public preview URL for the given port.
    Uses the REST API: GET /api/sandbox/{id}/ports/{port}/preview-url
    The URL format is: https://{port}-{sandboxId}.daytonaproxy01.eu
    This URL is permanent (doesn't expire) as long as the sandbox exists."""
    req = urllib.request.Request(
        f"{DAYTONA_API}/sandbox/{sandbox_id}/ports/{port}/preview-url",
        headers={"Authorization": f"Bearer {DAYTONA_TOKEN}"},
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        data = json.loads(resp.read())
        return data.get("url", "")


# --- GitHub backup/restore ---

def gh_api(method: str, path: str, body: dict | None = None) -> dict:
    url = f"https://api.github.com/repos/{GH_REPO}/{path}"
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {GH_TOKEN}",
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
        method=method,
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def download_backup() -> bytes | None:
    """Download the latest MySQL backup from the GitHub repo."""
    if not GH_TOKEN or not GH_REPO:
        print("  GH_TOKEN/GH_REPO not set — skipping backup download")
        return None
    try:
        data = gh_api("GET", f"contents/{BACKUP_FILE}")
        import urllib.parse
        download_url = data.get("download_url")
        if not download_url:
            return None
        req = urllib.request.Request(download_url)
        with urllib.request.urlopen(req, timeout=60) as resp:
            return resp.read()  # base64-encoded gzip
    except urllib.error.HTTPError as e:
        if e.code == 404:
            print("  No backup file found in repo (first run)")
            return None
        raise


def upload_backup(b64_data: str):
    """Upload MySQL backup to the GitHub repo."""
    if not GH_TOKEN or not GH_REPO:
        print("  GH_TOKEN/GH_REPO not set — skipping backup upload")
        return

    # Get the SHA of the existing file (if any) so we can update it
    sha = None
    try:
        data = gh_api("GET", f"contents/{BACKUP_FILE}")
        sha = data.get("sha")
    except urllib.error.HTTPError:
        pass  # file doesn't exist yet

    body = {
        "message": "chore: auto-backup MySQL data",
        "content": b64_data,
        "branch": "main",
    }
    if sha:
        body["sha"] = sha

    gh_api("PUT", f"contents/{BACKUP_FILE}", body)
    print(f"  Backup uploaded to {BACKUP_FILE} ({len(b64_data)} bytes)")


# --- Health check ---

def check_backend_alive(public_url: str) -> bool:
    """Ping the backend. Returns True if it responds with any HTTP status."""
    try:
        req = urllib.request.Request(
            f"{public_url}/api/client/permissions",
            headers={"Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status in (200, 401, 302, 403, 404)
    except urllib.error.HTTPError as e:
        # Any HTTP response (even 401/403/404) means the server is alive
        return e.code in (200, 401, 302, 403, 404, 500)
    except Exception:
        return False


# --- Backup (runs when backend is alive) ---

def do_backup(sandbox_id: str) -> bool:
    """Dump MySQL, compress, base64-encode, and upload to GitHub."""
    print("=== Backing up MySQL ===")
    code, out = exec_cmd(
        sandbox_id,
        f"mysqldump -u root -p{MYSQL_ROOT_PW} --all-databases --single-transaction --routines --triggers 2>/dev/null | gzip | base64 -w0",
        timeout=120,
    )
    if code != 0 or not out.strip():
        print(f"  mysqldump failed: {out[:200]}")
        return False

    b64 = out.strip()
    print(f"  Backup size: {len(b64)} bytes (base64)")

    upload_backup(b64)
    return True


# --- Restore (runs when a new sandbox is created) ---

def do_restore(sandbox_id: str, backup_b64: bytes) -> bool:
    """Upload the backup to the sandbox and import it into MySQL."""
    if not backup_b64:
        print("  No backup to restore — starting fresh")
        return False

    print(f"=== Restoring MySQL from backup ({len(backup_b64)} bytes) ===")

    # Upload the backup in chunks
    b64_str = backup_b64.decode() if isinstance(backup_b64, bytes) else backup_b64
    CHUNK = 50000
    chunks = [b64_str[i:i + CHUNK] for i in range(0, len(b64_str), CHUNK)]
    print(f"  Uploading {len(chunks)} chunks...")

    exec_cmd(sandbox_id, "rm -f /tmp/restore.b64 /tmp/restore.sql.gz")

    for i, chunk in enumerate(chunks):
        code, _ = exec_cmd(sandbox_id, f"printf '%s' '{chunk}' >> /tmp/restore.b64", timeout=15)
        if code != 0:
            print(f"  FAILED at chunk {i}")
            return False

    # Decode + import
    code, out = exec_cmd(
        sandbox_id,
        f"base64 -d /tmp/restore.b64 > /tmp/restore.sql.gz && "
        f"gunzip -f /tmp/restore.sql.gz && "
        f"mysql -u root -p{MYSQL_ROOT_PW} < /tmp/restore.sql 2>&1 | tail -5 && "
        f"rm -f /tmp/restore.b64 /tmp/restore.sql && "
        f"echo RESTORED",
        timeout=120,
    )
    print(f"  Restore: {out[-200:]}")
    return "RESTORED" in out


# --- Full deploy (runs when a new sandbox is created) ---

def deploy_backend(sandbox_id: str, public_url: str, backup_b64: bytes | None) -> bool:
    """Full deploy: install packages, upload code, configure, restore, start."""
    frontend_domain = "deathlegionpanel.vercel.app"
    session_domain = ".daytonaproxy01.eu"

    # Step 1: Install packages
    print("  Step 1/8: Installing PHP + MySQL + Redis")
    code, out = exec_cmd(
        sandbox_id,
        "sudo apt-get update -qq 2>&1 | tail -1 && "
        "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "
        "php-cli php-mbstring php-xml php-curl php-zip php-gd php-bcmath "
        "php-mysql php-redis php-gmp php-intl php-sqlite3 "
        "mariadb-server redis-server composer git unzip curl 2>&1 | tail -1 && "
        "echo OK",
        timeout=300,
    )
    if "OK" not in out:
        print(f"  FAILED: {out[-200:]}")
        return False

    # Step 2: Start MySQL + Redis
    print("  Step 2/8: Starting MySQL + Redis")
    exec_cmd(
        sandbox_id,
        "sudo mkdir -p /run/mysqld && sudo chown mysql:mysql /run/mysqld && "
        "sudo mariadbd --user=mysql --datadir=/var/lib/mysql --socket=/run/mysqld/mysqld.sock "
        "--bind-address=127.0.0.1 --port=3306 > /tmp/mysql.log 2>&1 &"
        "sleep 5 && "
        "redis-server --daemonize yes --port 6379 --bind 127.0.0.1 && "
        "sleep 1 && echo OK",
        timeout=30,
    )

    # Step 3: Configure MySQL root + create DB + user
    print("  Step 3/8: Configuring MySQL")
    # First try with existing password, then reset if needed
    exec_cmd(
        sandbox_id,
        f"mysql -u root -p{MYSQL_ROOT_PW} -e 'SELECT 1' 2>/dev/null || "
        f"sudo mysql -e \"ALTER USER root@localhost IDENTIFIED BY '{MYSQL_ROOT_PW}'; FLUSH PRIVILEGES;\" 2>/dev/null || true",
        timeout=15,
    )
    exec_cmd(
        sandbox_id,
        f"mysql -u root -p{MYSQL_ROOT_PW} -e \""
        f"CREATE USER IF NOT EXISTS pterodactyl@localhost IDENTIFIED BY '{MYSQL_APP_PW}';"
        f"CREATE DATABASE IF NOT EXISTS pterodactyl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
        f"GRANT ALL PRIVILEGES ON pterodactyl.* TO pterodactyl@localhost;"
        f"FLUSH PRIVILEGES;\" 2>&1 && echo OK",
        timeout=15,
    )

    # Step 4: Upload backend code
    print("  Step 4/8: Uploading backend code")
    tar_path = "/tmp/daytona-backend.tar.gz"
    subprocess.run(
        ["tar", "-czf", tar_path,
         "--exclude=vendor", "--exclude=node_modules",
         "--exclude=storage/logs/*", "--exclude=storage/framework/*",
         "--exclude=.env", "-C", str(REPO_ROOT), "backend"],
        check=True, capture_output=True,
    )
    with open(tar_path, "rb") as f:
        tar_bytes = f.read()
    import base64 as b64mod
    b64_data = b64mod.b64encode(tar_bytes).decode()

    exec_cmd(sandbox_id, "rm -f /tmp/b64part-* /tmp/backend.tar.gz")
    CHUNK = 50000
    chunks = [b64_data[i:i + CHUNK] for i in range(0, len(b64_data), CHUNK)]
    for i, chunk in enumerate(chunks):
        exec_cmd(sandbox_id, f"printf '%s' '{chunk}' > /tmp/b64part-{i:04d}", timeout=15)
    code, out = exec_cmd(
        sandbox_id,
        "cd /home/daytona && cat /tmp/b64part-* > /tmp/upload.b64 && rm -f /tmp/b64part-* && "
        "base64 -d /tmp/upload.b64 > /tmp/backend.tar.gz && rm /tmp/upload.b64 && "
        "rm -rf backend && tar -xzf /tmp/backend.tar.gz && rm /tmp/backend.tar.gz && echo OK",
        timeout=60,
    )
    if "OK" not in out:
        print(f"  Upload FAILED: {out[-200:]}")
        return False

    # Step 5: Composer install
    print("  Step 5/8: Composer install")
    exec_cmd(
        sandbox_id,
        "cd /home/daytona/backend && composer config platform.php 8.4 2>/dev/null; "
        "rm -f composer.lock && composer update --no-dev --optimize-autoloader --no-interaction 2>&1 | tail -3 && echo OK",
        timeout=600,
    )

    # Step 6: Generate .env
    print("  Step 6/8: Generating .env")
    exec_cmd(
        sandbox_id,
        "cd /home/daytona/backend && cp .env.example .env && "
        f"KEY=$(php -r 'echo base64_encode(random_bytes(32));') && "
        f"sed -i \"s|^APP_KEY=.*|APP_KEY=base64:$KEY|\" .env && echo OK",
        timeout=15,
    )

    # Patch .env via a python script
    patch_script = f'''
import re
patches = [
    ("APP_ENV", "production"),
    ("APP_DEBUG", "false"),
    ("APP_URL", "{public_url}"),
    ("FRONTEND_URL", "https://{frontend_domain}"),
    ("FORCE_HTTPS", "true"),
    ("DB_HOST", "127.0.0.1"),
    ("DB_PORT", "3306"),
    ("DB_DATABASE", "pterodactyl"),
    ("DB_USERNAME", "pterodactyl"),
    ("DB_PASSWORD", "{MYSQL_APP_PW}"),
    ("REDIS_HOST", "127.0.0.1"),
    ("REDIS_PASSWORD", ""),
    ("CACHE_DRIVER", "redis"),
    ("SESSION_DRIVER", "redis"),
    ("SESSION_DOMAIN", "{session_domain}"),
    ("SESSION_SAMESITE", "none"),
    ("SESSION_SECURE_COOKIE", "true"),
    ("QUEUE_CONNECTION", "redis"),
    ("SANCTUM_STATEFUL_DOMAINS", "{frontend_domain},localhost,localhost:5173,127.0.0.1:5173"),
    ("CORS_ALLOWED_ORIGINS", "https://{frontend_domain},http://localhost:5173"),
    ("MAIL_MAILER", "log"),
    ("RECAPTCHA_ENABLED", "false"),
    ("LOG_CHANNEL", "stderr"),
    ("LOG_LEVEL", "warning"),
]
# Also disable Laravel CORS (Daytona proxy handles it)
with open("/home/daytona/backend/.env", "r") as f:
    content = f.read()
for key, val in patches:
    pattern = rf"^{{key}}=.*$"
    replacement = f"{{key}}={{val}}"
    content, count = re.subn(pattern, replacement, content, flags=re.MULTILINE)
    if count == 0:
        content += f"\\n{{replacement}}\\n"
with open("/home/daytona/backend/.env", "w") as f:
    f.write(content)
print("PATCHED")
'''
    b64_patch = base64.b64encode(patch_script.encode()).decode()
    exec_cmd(sandbox_id, f"printf '%s' '{b64_patch}' | base64 -d > /tmp/patch.py && python3 /tmp/patch.py", timeout=15)

    # Disable Laravel CORS (Daytona proxy handles it)
    exec_cmd(
        sandbox_id,
        "cd /home/daytona/backend && sed -i \"s|'paths' => \\[.*\\]|'paths' => []|\" config/cors.php",
        timeout=10,
    )

    # Step 7: Restore from backup (if available) THEN migrate
    print("  Step 7/8: Restoring data + migrating")
    if backup_b64:
        do_restore(sandbox_id, backup_b64)

    exec_cmd(
        sandbox_id,
        "cd /home/daytona/backend && mkdir -p storage/framework/{views,sessions,cache} storage/logs bootstrap/cache && "
        "php artisan migrate --force 2>&1 | tail -3 && "
        "php artisan config:cache && php artisan route:cache && php artisan view:cache && "
        "php artisan event:cache && php artisan optimize 2>&1 | tail -2 && echo OK",
        timeout=180,
    )

    # Step 8: Start server + queue + Docker + Wings + create admin if missing
    print("  Step 8/9: Starting server + queue worker")
    exec_cmd(
        sandbox_id,
        "cd /home/daytona/backend && "
        "nohup php artisan queue:work redis --sleep=3 --tries=3 --max-time=3600 > storage/logs/worker.log 2>&1 &"
        "( while true; do cd /home/daytona/backend && php artisan schedule:run --no-interaction >> storage/logs/scheduler.log 2>&1; sleep 60; done ) &"
        "setsid nohup php artisan serve --host=0.0.0.0 --port=8000 --no-interaction > storage/logs/server.log 2>&1 < /dev/null & disown;"
        "sleep 4; echo OK",
        timeout=20,
    )

    # Step 9: Install Docker + Wings (for game server hosting)
    print("  Step 9/9: Installing Docker + Wings")
    exec_cmd(
        sandbox_id,
        # Install Docker if not present
        "which docker >/dev/null 2>&1 || (curl -fsSL https://get.docker.com -o /tmp/get-docker.sh && sh /tmp/get-docker.sh) ; "
        # Start Docker daemon
        "sudo dockerd > /tmp/dockerd.log 2>&1 & sleep 5; "
        # Install Wings if not present
        "which wings >/dev/null 2>&1 || (sudo curl -fsSL -o /usr/local/bin/wings https://github.com/pterodactyl/wings/releases/download/v1.13.1/wings_linux_amd64 && sudo chmod +x /usr/local/bin/wings) ; "
        # Create config directory
        "sudo mkdir -p /etc/pterodactyl /var/lib/pterodactyl/volumes ; "
        # Regenerate daemon_token + write config + start Wings
        f"cd /home/daytona/backend && php -r \""
        f"require 'vendor/autoload.php'; \\$app = require 'bootstrap/app.php'; \\$app->make('Illuminate\\\\Contracts\\\\Console\\\\Kernel')->bootstrap(); "
        f"use Pterodactyl\\\\Models\\\\Node; use Illuminate\\\\Support\\\\Str; "
        f"\\$node = Node::find(1); "
        f"if (\\$node) {{ "
        f"  \\$tokenId = Str::random(16); "
        f"  \\$plainToken = Str::random(64); "
        f"  \\\\DB::table('nodes')->where('id', 1)->update(['daemon_token_id' => \\$tokenId, 'daemon_token' => encrypt(\\$plainToken), 'fqdn' => 'localhost', 'scheme' => 'http']); "
        f"  echo 'TOKEN_ID:' . \\$tokenId . chr(10); "
        f"  echo 'TOKEN:' . \\$plainToken . chr(10); "
        f"}} else echo 'NO_NODE' . chr(10); "
        f"\" > /tmp/token_info.txt 2>&1 ; "
        # Read token info + write Wings config
        "TOKEN_ID=$(grep TOKEN_ID: /tmp/token_info.txt | cut -d: -f2) && "
        "TOKEN=$(grep TOKEN: /tmp/token_info.txt | cut -d: -f2) && "
        "if [ -n \"$TOKEN_ID\" ] && [ -n \"$TOKEN\" ]; then "
        "  echo 'debug: false' | sudo tee /etc/pterodactyl/config.yml > /dev/null && "
        "  echo 'api:' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  echo '  host: 127.0.0.1' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  echo '  port: 8080' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  echo '  ssl:' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  echo '    enabled: false' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  echo 'system:' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  echo '  data: /var/lib/pterodactyl/volumes' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  echo '  sftp:' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  echo '    bind_port: 2022' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  echo '  user:' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  echo '    root: true' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  echo 'remote: http://127.0.0.1:8000' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  echo 'token_id: \"'\"$TOKEN_ID\"'\"' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  echo 'token: \"'\"$TOKEN\"'\"' | sudo tee -a /etc/pterodactyl/config.yml > /dev/null && "
        "  sudo setsid nohup /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 < /dev/null & disown; "
        "  sleep 5; "
        "  curl -s -o /dev/null -w WINGS=%{http_code} http://127.0.0.1:8080/api/system; echo; "
        "fi; "
        "echo WINGS_SETUP_DONE",
        timeout=300,
    )

    # Create admin if missing (idempotent)
    exec_cmd(
        sandbox_id,
        f"cd /home/daytona/backend && "
        f"EXISTS=$(php -r \"require 'vendor/autoload.php'; \\$app = require 'bootstrap/app.php'; \\$app->make('Illuminate\\\\Contracts\\\\Console\\\\Kernel')->bootstrap(); "
        f"use Pterodactyl\\\\Models\\\\User; echo User::where('email','{ADMIN_EMAIL}')->exists() ? 'yes' : 'no';\" 2>/dev/null) && "
        f"if [ \"$EXISTS\" = \"no\" ]; then php artisan p:user:make --email '{ADMIN_EMAIL}' --username '{ADMIN_USERNAME}' --name-first Admin --name-last User --password '{ADMIN_PASSWORD}' --admin 1 2>&1 | tail -3; fi && "
        f"echo DONE",
        timeout=30,
    )

    return True


# --- Vercel env update ---

def update_vercel_url(new_url: str):
    """Update VITE_API_URL on Vercel + trigger redeploy."""
    if not VERCEL_TOKEN:
        print("  VERCEL_TOKEN not set — skipping Vercel update")
        return

    print(f"  Updating Vercel VITE_API_URL to {new_url}")

    # Remove existing env var
    try:
        req = urllib.request.Request(
            f"https://api.vercel.com/v9/projects/{VERCEL_PROJECT_ID}/env?name=VITE_API_URL&target=production",
            headers={"Authorization": f"Bearer {VERCEL_TOKEN}"},
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            for env in data.get("envs", []):
                delete_req = urllib.request.Request(
                    f"https://api.vercel.com/v9/projects/{VERCEL_PROJECT_ID}/env/{env['id']}",
                    headers={"Authorization": f"Bearer {VERCEL_TOKEN}"},
                    method="DELETE",
                )
                urllib.request.urlopen(delete_req, timeout=15)
    except Exception:
        pass

    # Set new env var
    body = {
        "key": "VITE_API_URL",
        "value": new_url,
        "type": "encrypted",
        "target": ["production"],
    }
    req = urllib.request.Request(
        f"https://api.vercel.com/v9/projects/{VERCEL_PROJECT_ID}/env",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {VERCEL_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        urllib.request.urlopen(req, timeout=15)
        print("  VITE_API_URL updated on Vercel")
    except Exception as e:
        print(f"  Vercel env update failed: {e}")

    # Trigger redeploy
    # Get the latest production deployment
    req = urllib.request.Request(
        f"https://api.vercel.com/v6/deployments?projectId={VERCEL_PROJECT_ID}&target=production&limit=1",
        headers={"Authorization": f"Bearer {VERCEL_TOKEN}"},
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            deployments = data.get("deployments", [])
            if deployments:
                deploy_id = deployments[0]["uid"]
                redeploy_req = urllib.request.Request(
                    f"https://api.vercel.com/v13/deployments",
                    data=json.dumps({"deploymentId": deploy_id, "target": "production"}).encode(),
                    headers={
                        "Authorization": f"Bearer {VERCEL_TOKEN}",
                        "Content-Type": "application/json",
                    },
                    method="POST",
                )
                urllib.request.urlopen(redeploy_req, timeout=15)
                print("  Vercel redeploy triggered")
    except Exception as e:
        print(f"  Vercel redeploy failed: {e}")


# --- Main self-heal logic ---

def main() -> int:
    print(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] Self-heal check starting")

    # Find the sandbox
    sb = find_sandbox(SANDBOX_NAME)
    if not sb:
        print("  Sandbox not found — creating new one")
        sb = create_sandbox()
        if not sb:
            return 1
    elif sb["state"] in ("archived", "stopped", "paused"):
        print(f"  Sandbox state={sb['state']} — starting it")
        try:
            api_post(f"/sandbox/{sb['id']}/start", {})
            time.sleep(30)
        except Exception:
            print("  Start failed — deleting + recreating")
            try:
                api_delete(f"/sandbox/{sb['id']}")
            except Exception:
                pass
            sb = create_sandbox()
            if not sb:
                return 1
    else:
        print(f"  Sandbox state={sb['state']}")

    sandbox_id = sb["id"]

    # Get the public URL
    public_url = get_preview_url(sandbox_id, 8000)
    if not public_url:
        print("  Could not get public URL — trying to recreate")
        return 1

    print(f"  Public URL: {public_url}")

    # Check if backend is alive
    alive = check_backend_alive(public_url)
    print(f"  Backend alive: {alive}")

    if alive:
        # Just do a backup
        print("  Backend is alive — running MySQL backup")
        do_backup(sandbox_id)
        print("  ✓ Done")
        return 0

    # Backend is dead — need to redeploy
    print("  Backend is dead — checking if sandbox needs recreation")
    print(f"  Public URL: {public_url}")

    # Download the latest backup BEFORE recreating
    print("  Downloading latest backup from GitHub...")
    backup_b64 = download_backup()

    # Full deploy
    print("  Running full deploy...")
    success = deploy_backend(sandbox_id, public_url, backup_b64)

    if not success:
        print("  Deploy failed — will retry next cycle")
        return 1

    # Verify backend is now alive
    time.sleep(5)
    alive = check_backend_alive(public_url)
    if not alive:
        print("  Backend still not responding after deploy — will retry next cycle")
        return 1

    print(f"  ✓ Backend is live at {public_url}")

    # Update Vercel env (in case the URL changed)
    update_vercel_url(public_url)

    # Do a fresh backup
    do_backup(sandbox_id)

    print("  ✓ Self-heal complete")
    return 0


def create_sandbox() -> dict | None:
    """Create a new sandbox and return its info."""
    print(f"  Creating new sandbox '{SANDBOX_NAME}'...")
    try:
        result = api_post("/sandbox", {
            "name": SANDBOX_NAME,
            "snapshot": SNAPSHOT,
            "target": REGION,
            "public": True,
            "autoStopInterval": 0,
            "autoArchiveInterval": 0,
            "autoDeleteInterval": -1,
        }, timeout=60)
        print(f"  Created: {result.get('id', 'unknown')}")
        time.sleep(10)  # wait for it to start
        return result
    except Exception as e:
        print(f"  Create failed: {e}")
        return None


if __name__ == "__main__":
    sys.exit(main())
