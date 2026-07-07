#!/usr/bin/env python3
"""Diagnose Pterodactyl on Daytona - check APP_KEY, session, DB, services."""
import os, json, subprocess, urllib.request, urllib.error

DAYTONA_TOKEN = os.environ.get('DAYTONA_TOKEN', 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22')
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
DAYTONA_API = 'https://app.daytona.io/api'

def run_cmd(cmd, timeout=30):
    """Execute a shell command in the Daytona sandbox."""
    url = f'{DAYTONA_API}/toolbox/{SANDBOX_ID}/toolbox/process/execute'
    body = json.dumps({
        'command': cmd,
        'cwd': '/home/daytona',
        'timeout': timeout,
    }).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': f'Bearer {DAYTONA_TOKEN}',
        'Content-Type': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=timeout+5) as r:
            data = json.loads(r.read().decode())
            return data.get('result', '') or data.get('exitCode', 'no-result')
    except urllib.error.HTTPError as e:
        return f'HTTP {e.code}: {e.read().decode()[:500]}'
    except Exception as e:
        return f'ERR: {e}'

# Diagnostics
checks = [
    ("=== Pterodactyl .env APP_KEY ===",
     "grep -E '^APP_KEY=' /home/daytona/panel/.env 2>/dev/null || grep -E '^APP_KEY=' /var/www/pterodactyl/.env 2>/dev/null || find / -name '.env' -path '*pterodactyl*' 2>/dev/null | head -5"),
    ("=== Find panel install ===",
     "ls -la /home/daytona/panel 2>/dev/null; ls -la /var/www/pterodactyl 2>/dev/null; ls -la /opt/pterodactyl 2>/dev/null"),
    ("=== Running processes ===",
     "ps aux | grep -E 'php-fpm|nginx|mysql|redis|wings|artisan' | grep -v grep | head -20"),
    ("=== Listening ports ===",
     "ss -tlnp 2>/dev/null | head -30 || netstat -tlnp 2>/dev/null | head -30"),
    ("=== PHP-FPM status ===",
     "systemctl status php8.2-fpm 2>/dev/null | head -10 || service php8.2-fpm status 2>/dev/null | head -10"),
    ("=== Nginx status ===",
     "systemctl status nginx 2>/dev/null | head -10 || service nginx status 2>/dev/null | head -10"),
    ("=== MySQL status ===",
     "systemctl status mysql 2>/dev/null | head -10 || service mysql status 2>/dev/null | head -10 || systemctl status mariadb 2>/dev/null | head -10"),
    ("=== Wings status ===",
     "systemctl status wings 2>/dev/null | head -15 || ps aux | grep wings | grep -v grep"),
    ("=== Panel config (APP_URL, SESSION_DOMAIN) ===",
     "grep -E '^(APP_URL|APP_KEY|SESSION_DOMAIN|SESSION_DRIVER|SESSION_SECURE_COOKIE|SANCTUM_STATEFUL_DOMAINS|TRUSTED_PROXIES)=' /home/daytona/panel/.env 2>/dev/null || grep -E '^(APP_URL|APP_KEY|SESSION_DOMAIN|SESSION_DRIVER|SESSION_SECURE_COOKIE|SANCTUM_STATEFUL_DOMAINS|TRUSTED_PROXIES)=' /var/www/pterodactyl/.env 2>/dev/null"),
    ("=== Test panel HTTP locally ===",
     "curl -s -o /dev/null -w 'HTTP:%{http_code}\\n' http://127.0.0.1:8000/ ; curl -s -o /dev/null -w 'HTTP:%{http_code}\\n' http://127.0.0.1/"),
    ("=== Panel logs (recent errors) ===",
     "tail -50 /home/daytona/panel/storage/logs/laravel.log 2>/dev/null || tail -50 /var/www/pterodactyl/storage/logs/laravel.log 2>/dev/null || echo 'no log'"),
    ("=== Nginx error log ===",
     "tail -30 /var/log/nginx/error.log 2>/dev/null"),
]

for label, cmd in checks:
    print(label)
    print(run_cmd(cmd))
    print()
