#!/usr/bin/env python3
"""
Deploy the Pterodactyl backend to a Daytona sandbox via the REST API.

Uses POST /api/toolbox/{sandboxId}/toolbox/process/execute for command execution
(works reliably — the `daytona exec` CLI mangles args).

Usage:
    python3 scripts/daytona-deploy.py
"""
import json
import os
import sys
import time
import urllib.request
import urllib.error
import base64
import subprocess
from pathlib import Path

# --- Configuration ---
DAYTONA_TOKEN = "<DAYTONA_TOKEN>"
DAYTONA_API = "https://app.daytona.io/api"
SANDBOX_NAME = "pterodactyl-backend"

# Admin credentials for the panel
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@deathlegion.local")
ADMIN_USERNAME = os.environ.get("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "<ADMIN_PASSWORD>")
ADMIN_FIRST = os.environ.get("ADMIN_FIRST", "Admin")
ADMIN_LAST = os.environ.get("ADMIN_LAST", "User")

# Database passwords
MYSQL_ROOT_PW = "<MYSQL_ROOT_PW>"
MYSQL_APP_PW = "<MYSQL_APP_PW>"

# Frontend domain (Vercel) — for CORS
FRONTEND_DOMAIN = "deathlegionpanel.vercel.app"

REPO_ROOT = Path(__file__).resolve().parent.parent


def api_get(path: str) -> dict:
    req = urllib.request.Request(
        f"{DAYTONA_API}{path}",
        headers={"Authorization": f"Bearer {DAYTONA_TOKEN}"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def api_post(path: str, body: dict, raw: bool = False) -> dict | str:
    req = urllib.request.Request(
        f"{DAYTONA_API}{path}",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {DAYTONA_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        data = resp.read()
        if raw:
            return data
        return json.loads(data)


def exec_cmd(sandbox_id: str, command: str, cwd: str = "/home/daytona", timeout: int = 60) -> tuple[int, str]:
    """Run a command in the sandbox via the toolbox execute API."""
    try:
        result = api_post(
            f"/toolbox/{sandbox_id}/toolbox/process/execute",
            {"command": command, "cwd": cwd, "timeout": timeout},
        )
        return int(result.get("exitCode", -1)), result.get("result", "")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  ERROR {e.code}: {body[:200]}", file=sys.stderr)
        return e.code, body


def find_sandbox(name: str) -> dict | None:
    data = api_get("/sandbox")
    for sb in data.get("items", []):
        if sb["name"] == name:
            return sb
    return None


def upload_file(sandbox_id: str, local_path: Path, remote_path: str) -> bool:
    """Upload a single file using the bulk-upload endpoint."""
    # Try the upload endpoint
    files_data = local_path.read_bytes()
    b64 = base64.b64encode(files_data).decode()

    # Try the upload endpoint
    try:
        body = api_post(
            f"/toolbox/{sandbox_id}/toolbox/files/upload",
            {"file": b64, "path": remote_path},
        )
        print(f"  Uploaded {local_path.name} -> {remote_path}")
        return True
    except urllib.error.HTTPError as e:
        print(f"  Upload failed: {e.code} {e.read().decode()[:200]}", file=sys.stderr)
        return False


def main() -> int:
    print("=== Finding sandbox ===")
    sb = find_sandbox(SANDBOX_NAME)
    if not sb:
        print(f"ERROR: sandbox '{SANDBOX_NAME}' not found. Create it first.", file=sys.stderr)
        return 1
    print(f"  Found: {sb['id']} state={sb['state']} region={sb['target']}")
    sandbox_id = sb["id"]

    # STEP 1: Install system packages
    print("\n=== Step 1/8: Installing PHP + MySQL + Redis ===")
    code, out = exec_cmd(
        sandbox_id,
        "sudo apt-get update -qq 2>&1 | tail -3 && "
        "sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq "
        "php-cli php-mbstring php-xml php-curl php-zip php-gd php-bcmath "
        "php-mysql php-redis php-gmp php-intl php-sqlite3 "
        "mariadb-server redis-server composer git unzip curl 2>&1 | tail -3 && "
        "echo OK",
        timeout=300,
    )
    print(f"  exit={code}\n  {out[-500:]}")
    if "OK" not in out:
        print("FAILED", file=sys.stderr)
        return 1

    # STEP 2: Start MySQL + Redis
    print("\n=== Step 2/8: Starting MySQL + Redis ===")
    code, out = exec_cmd(
        sandbox_id,
        "sudo mkdir -p /run/mysqld && sudo chown mysql:mysql /run/mysqld && "
        "sudo mariadbd --user=mysql --datadir=/var/lib/mysql --socket=/run/mysqld/mysqld.sock "
        "--bind-address=127.0.0.1 --port=3306 > /tmp/mysql.log 2>&1 &"
        "sleep 5 && "
        "redis-server --daemonize yes --port 6379 --bind 127.0.0.1 && "
        "sleep 1 && "
        "redis-cli ping && "
        "echo OK",
        timeout=60,
    )
    print(f"  exit={code}\n  {out[-300:]}")

    # STEP 3: Configure MySQL root + create DB + user
    print("\n=== Step 3/8: Configuring MySQL ===")
    code, out = exec_cmd(
        sandbox_id,
        f"sudo mysql -e \""
        f"ALTER USER 'root'@'localhost' IDENTIFIED BY '{MYSQL_ROOT_PW}'; "
        f"CREATE USER IF NOT EXISTS 'pterodactyl'@'localhost' IDENTIFIED BY '{MYSQL_APP_PW}'; "
        f"CREATE DATABASE IF NOT EXISTS pterodactyl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; "
        f"GRANT ALL PRIVILEGES ON pterodactyl.* TO 'pterodactyl'@'localhost'; "
        f"FLUSH PRIVILEGES;\" && "
        f"mysql -u pterodactyl -p{MYSQL_APP_PW} -e 'USE pterodactyl; SELECT \"DB OK\";' && "
        f"echo OK",
        timeout=30,
    )
    print(f"  exit={code}\n  {out[-300:]}")

    # STEP 4: Clone the repo (use a public mirror so we don't need to upload)
    # Since we don't have a public repo, we'll upload our local copy via base64.
    # But first, check if there's an existing copy.
    print("\n=== Step 4/8: Uploading backend code ===")

    # Tar + base64 the backend dir, then upload via stdin to execute API.
    # The API has a body size limit (~1MB), so we chunk.
    print("  Packaging backend/ ...")
    tar_path = "/tmp/daytona-backend.tar.gz"
    subprocess.run(
        [
            "tar", "-czf", tar_path,
            "--exclude=vendor",
            "--exclude=node_modules",
            "--exclude=storage/logs/*",
            "--exclude=storage/framework/*",
            "--exclude=.env",
            "-C", str(REPO_ROOT),
            "backend",
        ],
        check=True,
    )
    tar_size = os.path.getsize(tar_path)
    print(f"  Packaged: {tar_size} bytes")

    # Read the tar, base64 it, split into chunks, write each chunk to a file
    # in the sandbox, then concatenate + decode.
    with open(tar_path, "rb") as f:
        tar_bytes = f.read()
    b64_data = base64.b64encode(tar_bytes).decode()
    print(f"  Base64 size: {len(b64_data)} bytes")

    # Clear any previous upload
    exec_cmd(sandbox_id, "rm -f /tmp/b64part-* /tmp/backend.tar.gz")

    # Chunk into 50KB pieces (safe under API body limit)
    CHUNK = 50000
    chunks = [b64_data[i:i + CHUNK] for i in range(0, len(b64_data), CHUNK)]
    print(f"  Uploading {len(chunks)} chunks...")

    # Write each chunk to its own file (using printf so we control exact bytes)
    for i, chunk in enumerate(chunks):
        # Use a single-quoted printf '%s' with the chunk as arg
        # The execute API passes the command verbatim, so this works.
        code, out = exec_cmd(
            sandbox_id,
            f"printf '%s' '{chunk}' > /tmp/b64part-{i:04d}",
            timeout=15,
        )
        if code != 0:
            print(f"  FAILED at chunk {i}: {out[:200]}", file=sys.stderr)
            return 1
        if (i + 1) % 5 == 0:
            print(f"    {i + 1}/{len(chunks)} chunks uploaded")

    print(f"  All {len(chunks)} chunks uploaded")

    # Concatenate + decode + extract
    code, out = exec_cmd(
        sandbox_id,
        "cd /home/daytona && "
        "cat /tmp/b64part-* > /tmp/upload.b64 && "
        "rm -f /tmp/b64part-* && "
        "base64 -d /tmp/upload.b64 > /tmp/backend.tar.gz && "
        "rm /tmp/upload.b64 && "
        "ls -la /tmp/backend.tar.gz && "
        "rm -rf backend && "
        "tar -xzf /tmp/backend.tar.gz && "
        "rm /tmp/backend.tar.gz && "
        "ls backend/ | head -5 && "
        "echo OK",
        timeout=60,
    )
    print(f"  Extract: exit={code}\n  {out[-400:]}")
    if "OK" not in out:
        print("FAILED to extract backend", file=sys.stderr)
        return 1

    # STEP 5: Composer install + adjust PHP version constraint (Pterodactyl says 8.0-8.2, we have 8.4)
    print("\n=== Step 5/8: Composer install ===")
    code, out = exec_cmd(
        sandbox_id,
        "cd /home/daytona/backend && "
        # Pterodactyl composer.json requires php ^8.0.2 || ^8.1 || ^8.2. We have 8.4. Override platform.
        "composer config platform.php 8.2 && "
        "composer install --no-dev --optimize-autoloader --no-interaction 2>&1 | tail -10 && "
        "echo OK",
        timeout=600,
    )
    print(f"  exit={code}\n  {out[-600:]}")
    if "OK" not in out:
        print("Composer install failed", file=sys.stderr)
        return 1

    # STEP 6: Generate .env + key
    print("\n=== Step 6/8: Generating .env ===")
    code, out = exec_cmd(
        sandbox_id,
        "cd /home/daytona/backend && "
        "cp .env.example .env && "
        "php artisan key:generate --force && "
        "echo OK",
        timeout=30,
    )
    print(f"  exit={code}\n  {out[-300:]}")

    # Patch .env with our values
    print("\n=== Patching .env ===")
    patches = [
        ("APP_NAME", "Pterodactyl"),
        ("APP_ENV", "production"),
        ("APP_DEBUG", "false"),
        ("APP_URL", "https://pterodactyl-backend-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu"),
        ("FRONTEND_URL", f"https://{FRONTEND_DOMAIN}"),
        ("FORCE_HTTPS", "true"),
        ("DB_HOST", "127.0.0.1"),
        ("DB_PORT", "3306"),
        ("DB_DATABASE", "pterodactyl"),
        ("DB_USERNAME", "pterodactyl"),
        ("DB_PASSWORD", MYSQL_APP_PW),
        ("REDIS_HOST", "127.0.0.1"),
        ("REDIS_PASSWORD", ""),
        ("CACHE_DRIVER", "redis"),
        ("SESSION_DRIVER", "redis"),
        ("SESSION_LIFETIME", "720"),
        ("SESSION_COOKIE", "pterodactyl_session"),
        ("SESSION_DOMAIN", ".daytonaproxy01.eu"),
        ("SESSION_SAMESITE", "none"),
        ("SESSION_SECURE_COOKIE", "true"),
        ("QUEUE_CONNECTION", "redis"),
        ("FILESYSTEM_DISK", "local"),
        ("SANCTUM_STATEFUL_DOMAINS", f"{FRONTEND_DOMAIN},localhost,localhost:5173,127.0.0.1:5173"),
        ("CORS_ALLOWED_ORIGINS", f"https://{FRONTEND_DOMAIN},http://localhost:5173"),
        ("MAIL_MAILER", "log"),
        ("RECAPTCHA_ENABLED", "false"),
        ("LOG_CHANNEL", "stderr"),
        ("LOG_LEVEL", "warning"),
        ("APP_BACKUP_DRIVER", "wings"),
    ]
    for key, val in patches:
        # Use sed to replace the line
        escaped = val.replace("/", "\\/").replace("&", "\\&")
        code, out = exec_cmd(
            sandbox_id,
            f"cd /home/daytona/backend && sed -i 's|^{key}=.*|{key}={escaped}|' .env",
        )
    print("  .env patched")

    # STEP 7: Migrate + cache
    print("\n=== Step 7/8: Migrating + caching ===")
    code, out = exec_cmd(
        sandbox_id,
        "cd /home/daytona/backend && "
        "php artisan migrate --force 2>&1 | tail -5 && "
        "php artisan config:cache && "
        "php artisan route:cache && "
        "php artisan view:cache && "
        "php artisan event:cache && "
        "php artisan optimize && "
        "echo OK",
        timeout=120,
    )
    print(f"  exit={code}\n  {out[-600:]}")
    if "OK" not in out:
        print("Migrate/cache failed", file=sys.stderr)
        return 1

    # STEP 8: Start Laravel server + queue worker + create admin
    print("\n=== Step 8/8: Starting server + creating admin ===")

    # Start queue worker + scheduler in background
    code, out = exec_cmd(
        sandbox_id,
        "cd /home/daytona/backend && "
        "nohup php artisan queue:work redis --sleep=3 --tries=3 --max-time=3600 "
        "> storage/logs/worker.log 2>&1 &"
        "echo 'queue worker started' && "
        "( while true; do cd /home/daytona/backend && php artisan schedule:run --no-interaction "
        ">> storage/logs/scheduler.log 2>&1; sleep 60; done ) &"
        "echo 'scheduler started' && "
        "nohup php artisan serve --host=0.0.0.0 --port=8000 "
        "> storage/logs/server.log 2>&1 &"
        "echo 'server started' && "
        "sleep 3 && "
        "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8000/api/client/ping && "
        "echo '' && echo OK",
        timeout=30,
    )
    print(f"  Server start: exit={code}\n  {out[-400:]}")

    # Create admin account
    print("\n=== Creating admin account ===")
    code, out = exec_cmd(
        sandbox_id,
        f"cd /home/daytona/backend && "
        # Check if exists first
        "EXISTS=$(php artisan tinker --execute=\""
        f"use Pterodactyl\\\\Models\\\\User; "
        f"\\$u = User::where('email', '{ADMIN_EMAIL}')->first(); "
        f"echo \\$u ? 'yes' : 'no';"
        "\" 2>/dev/null | tr -d '\\n\\r') && "
        f"echo \"exists=$EXISTS\" && "
        "if [ \"$EXISTS\" = \"no\" ] || [ -z \"$EXISTS\" ]; then "
        f"php artisan p:user:make --email '{ADMIN_EMAIL}' --username '{ADMIN_USERNAME}' "
        f"--name-first '{ADMIN_FIRST}' --name-last '{ADMIN_LAST}' "
        f"--password '{ADMIN_PASSWORD}' --admin 1 2>&1 | tail -10; "
        "else echo 'Admin already exists'; fi && "
        "echo OK",
        timeout=60,
    )
    print(f"  Admin create: exit={code}\n  {out[-500:]}")

    # Get the public URL via preview-url
    print("\n=== Getting public URL ===")
    code, out = exec_cmd(
        sandbox_id,
        "echo 'Sandbox info:'",
    )

    print("\n" + "=" * 60)
    print("  ✓ DEPLOYMENT COMPLETE")
    print("=" * 60)
    print(f"""
  Sandbox:        {SANDBOX_NAME} ({sandbox_id})
  Region:         {sb['target']}

  Local URL:      http://127.0.0.1:8000 (inside sandbox)
  Public URL:     https://pterodactyl-backend-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu
                  (need to get port 8000 preview URL)

  Admin login:    {ADMIN_EMAIL}
  Admin password: {ADMIN_PASSWORD}

  Frontend URL:   https://{FRONTEND_DOMAIN}

  Next: get a preview URL for port 8000:
    daytona preview-url {SANDBOX_NAME} --port 8000

  Then update Vercel VITE_API_URL to that preview URL.
""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
