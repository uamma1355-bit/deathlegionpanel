#!/usr/bin/env python3
"""
Redeploy the Pterodactyl backend to the Daytona sandbox after pushing code
changes to your local repo. Pulls latest code, runs composer install, migrate,
and restarts the Laravel server.

Usage:
    python3 scripts/daytona-redeploy.py
"""
import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

TOKEN = "<DAYTONA_TOKEN>"
SANDBOX_NAME = "pterodactyl-backend"
API = "https://app.daytona.io/api"
REPO_ROOT = Path(__file__).resolve().parent.parent


def api_get(path: str) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        headers={"Authorization": f"Bearer {TOKEN}"},
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def api_post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{API}{path}",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def exec_cmd(sandbox_id: str, command: str, timeout: int = 60) -> tuple[int, str]:
    result = api_post(
        f"/toolbox/{sandbox_id}/toolbox/process/execute",
        {"command": command, "cwd": "/home/daytona", "timeout": timeout},
    )
    return int(result.get("exitCode", -1)), result.get("result", "")


def find_sandbox(name: str) -> dict | None:
    data = api_get("/sandbox")
    for sb in data.get("items", []):
        if sb["name"] == name:
            return sb
    return None


def main() -> int:
    print("=== Finding sandbox ===")
    sb = find_sandbox(SANDBOX_NAME)
    if not sb:
        print(f"ERROR: sandbox '{SANDBOX_NAME}' not found.", file=sys.stderr)
        return 1
    print(f"  Found: {sb['id']} state={sb['state']}")
    sandbox_id = sb["id"]

    # Step 1: Package backend code
    print("\n=== Packaging backend/ ===")
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

    # Step 2: Upload via base64 chunks
    print("\n=== Uploading backend code ===")
    with open(tar_path, "rb") as f:
        tar_bytes = f.read()
    b64_data = base64.b64encode(tar_bytes).decode()

    exec_cmd(sandbox_id, "rm -f /tmp/b64part-* /tmp/backend.tar.gz")

    CHUNK = 50000
    chunks = [b64_data[i:i + CHUNK] for i in range(0, len(b64_data), CHUNK)]
    print(f"  Uploading {len(chunks)} chunks...")

    for i, chunk in enumerate(chunks):
        code, _ = exec_cmd(
            sandbox_id,
            f"printf '%s' '{chunk}' > /tmp/b64part-{i:04d}",
            timeout=15,
        )
        if code != 0:
            print(f"  FAILED at chunk {i}", file=sys.stderr)
            return 1
        if (i + 1) % 5 == 0:
            print(f"    {i + 1}/{len(chunks)}")

    # Concatenate + decode + extract
    code, out = exec_cmd(
        sandbox_id,
        "cd /home/daytona && "
        "cat /tmp/b64part-* > /tmp/upload.b64 && "
        "rm -f /tmp/b64part-* && "
        "base64 -d /tmp/upload.b64 > /tmp/backend.tar.gz && "
        "rm /tmp/upload.b64 && "
        "rm -rf backend && "
        "tar -xzf /tmp/backend.tar.gz && "
        "rm /tmp/backend.tar.gz && "
        "echo OK",
        timeout=60,
    )
    print(f"  Extract: exit={code} {out[-200:]}")
    if "OK" not in out:
        return 1

    # Step 3: Composer install (without removing lockfile if it exists)
    print("\n=== Composer install ===")
    code, out = exec_cmd(
        sandbox_id,
        "cd /home/daytona/backend && "
        "composer config platform.php 8.4 2>/dev/null; "
        "composer install --no-dev --optimize-autoloader --no-interaction 2>&1 | tail -5 && "
        "echo OK",
        timeout=600,
    )
    print(f"  exit={code} {out[-300:]}")

    # Step 4: Re-patch .env (in case it was reset)
    print("\n=== Re-patching .env ===")
    PUBLIC_URL = f"https://pterodactyl-backend-{sandbox_id}.daytonaproxy01.eu"
    patch_script = f'''
import re
patches = [
    ("APP_ENV", "production"),
    ("APP_DEBUG", "false"),
    ("APP_URL", "{PUBLIC_URL}"),
    ("FRONTEND_URL", "https://deathlegionpanel.vercel.app"),
    ("FORCE_HTTPS", "true"),
    ("DB_HOST", "127.0.0.1"),
    ("DB_PORT", "3306"),
    ("DB_DATABASE", "pterodactyl"),
    ("DB_USERNAME", "pterodactyl"),
    ("DB_PASSWORD", "<MYSQL_APP_PW>"),
    ("REDIS_HOST", "127.0.0.1"),
    ("REDIS_PASSWORD", ""),
    ("CACHE_DRIVER", "redis"),
    ("SESSION_DRIVER", "redis"),
    ("SESSION_DOMAIN", ".daytonaproxy01.eu"),
    ("SESSION_SAMESITE", "none"),
    ("SESSION_SECURE_COOKIE", "true"),
    ("QUEUE_CONNECTION", "redis"),
    ("SANCTUM_STATEFUL_DOMAINS", "deathlegionpanel.vercel.app,localhost,localhost:5173,127.0.0.1:5173"),
    ("CORS_ALLOWED_ORIGINS", "https://deathlegionpanel.vercel.app,http://localhost:5173"),
    ("MAIL_MAILER", "log"),
    ("RECAPTCHA_ENABLED", "false"),
    ("LOG_CHANNEL", "stderr"),
]
try:
    with open("/home/daytona/backend/.env", "r") as f:
        content = f.read()
except FileNotFoundError:
    # Re-create from example
    import shutil
    shutil.copy("/home/daytona/backend/.env.example", "/home/daytona/backend/.env")
    with open("/home/daytona/backend/.env", "r") as f:
        content = f.read()
    # Need to set a valid APP_KEY
    import subprocess
    key = subprocess.check_output(["php", "-r", "echo base64_encode(random_bytes(32));"]).decode().strip()
    content = re.sub(r"^APP_KEY=.*$", f"APP_KEY=base64:{{key}}", content, flags=re.MULTILINE)
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
    b64 = base64.b64encode(patch_script.encode()).decode()
    code, out = exec_cmd(
        sandbox_id,
        f"printf '%s' '{b64}' | base64 -d > /tmp/patch_env.py && python3 /tmp/patch_env.py",
        timeout=15,
    )
    print(f"  exit={code} {out}")

    # Step 5: Migrate + cache
    print("\n=== Migrate + cache ===")
    code, out = exec_cmd(
        sandbox_id,
        "cd /home/daytona/backend && "
        "mkdir -p storage/framework/{views,sessions,cache} storage/logs bootstrap/cache && "
        "php artisan migrate --force 2>&1 | tail -3 && "
        "php artisan config:cache && php artisan route:cache && "
        "php artisan view:cache && php artisan event:cache && "
        "php artisan optimize && echo OK",
        timeout=180,
    )
    print(f"  exit={code} {out[-200:]}")

    # Step 6: Restart Laravel server
    print("\n=== Restarting Laravel server ===")
    code, out = exec_cmd(
        sandbox_id,
        "pkill -f 'artisan serve' 2>/dev/null; sleep 2; "
        "cd /home/daytona/backend && "
        "setsid nohup php artisan serve --host=0.0.0.0 --port=8000 --no-interaction "
        "> storage/logs/server.log 2>&1 < /dev/null & disown; "
        "sleep 3; "
        "curl -s -o /dev/null -w HTTP=%{http_code} http://127.0.0.1:8000/api/client/permissions; "
        "echo; echo OK",
        timeout=20,
    )
    print(f"  exit={code} {out[-200:]}")

    # Step 7: Verify public URL
    print("\n=== Verifying public URL ===")
    import urllib.request as ur
    try:
        req = ur.Request(
            f"{PUBLIC_URL}/api/client/permissions",
            headers={"Accept": "application/json", "Origin": "https://deathlegionpanel.vercel.app"},
        )
        with ur.urlopen(req, timeout=15) as resp:
            print(f"  HTTP {resp.status} — backend is live!")
    except Exception as e:
        print(f"  verify failed: {e}")

    print("\n" + "=" * 60)
    print("  ✓ REDEPLOY COMPLETE")
    print("=" * 60)
    print(f"""
  Backend URL:  {PUBLIC_URL}
  Frontend URL: https://deathlegionpanel.vercel.app
  Admin login:  admin / <ADMIN_PASSWORD>
""")
    return 0


if __name__ == "__main__":
    sys.exit(main())
