#!/usr/bin/env python3
"""
Daytona keep-alive: pings the backend every 5 minutes to prevent the sandbox
from being auto-archived or stopped.

Run this on any machine (your laptop, GitHub Actions cron, etc.) —
NOT inside the sandbox itself.

Usage:
    nohup python3 scripts/daytona-keepalive.py > /tmp/keepalive.log 2>&1 &

Or as a GitHub Actions cron job (see .github/workflows/daytona-keepalive.yml).
"""
import json
import time
import urllib.request
import sys

TOKEN = "<DAYTONA_TOKEN>"
SANDBOX_NAME = "pterodactyl-backend"
PUBLIC_URL = "https://8000-wwx7nwx3ltspape9.daytonaproxy01.eu"
INTERVAL_SEC = 300  # 5 minutes


def keepalive_once() -> bool:
    """Ping the backend. If it's down, try to start the sandbox."""
    # 1. Hit the public URL
    try:
        req = urllib.request.Request(
            f"{PUBLIC_URL}/api/client/permissions",
            headers={
                "Accept": "application/json",
                "Origin": "https://deathlegionpanel.vercel.app",
            },
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            status = resp.status
            # 401 is fine — means the API is up
            if status in (200, 401):
                return True
            print(f"  unexpected status: {status}")
    except Exception as e:
        print(f"  ping failed: {e}")

    # 2. If ping failed, check sandbox state + restart it
    try:
        req = urllib.request.Request(
            "https://app.daytona.io/api/sandbox",
            headers={"Authorization": f"Bearer {TOKEN}"},
        )
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
        sb = next((s for s in data.get("items", []) if s["name"] == SANDBOX_NAME), None)
        if not sb:
            print(f"  sandbox {SANDBOX_NAME} not found!")
            return False

        sb_id = sb["id"]
        state = sb["state"]
        print(f"  sandbox state: {state}")

        if state in ("stopped", "paused", "archived"):
            print(f"  starting sandbox {sb_id}...")
            start_req = urllib.request.Request(
                f"https://app.daytona.io/api/sandbox/{sb_id}/start",
                headers={
                    "Authorization": f"Bearer {TOKEN}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(start_req) as resp:
                print(f"  start response: {resp.status}")
            # Wait for it to come up
            time.sleep(30)
            # Restart the Laravel server via the execute API
            print("  restarting Laravel server...")
            exec_req = urllib.request.Request(
                f"https://app.daytona.io/api/toolbox/{sb_id}/toolbox/process/execute",
                data=json.dumps({
                    "command": "cd /home/daytona/backend && nohup php artisan serve --host=0.0.0.0 --port=8000 --no-interaction > storage/logs/server.log 2>&1 < /dev/null & disown; sleep 3; ps aux | grep 'artisan serve' | grep -v grep | head -1",
                    "cwd": "/home/daytona",
                    "timeout": 15,
                }).encode(),
                headers={
                    "Authorization": f"Bearer {TOKEN}",
                    "Content-Type": "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(exec_req) as resp:
                print(f"  exec response: {json.loads(resp.read())}")

        return True
    except Exception as e:
        print(f"  restart failed: {e}")
        return False


def main() -> int:
    print(f"Daytona keep-alive started. Pinging every {INTERVAL_SEC}s.")
    print(f"  Sandbox: {SANDBOX_NAME}")
    print(f"  URL:     {PUBLIC_URL}")
    print(f"  Press Ctrl+C to stop.")

    while True:
        ts = time.strftime("%Y-%m-%d %H:%M:%S")
        ok = keepalive_once()
        print(f"[{ts}] {'OK' if ok else 'FAIL'}")
        time.sleep(INTERVAL_SEC)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nStopped.")
