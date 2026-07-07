#!/usr/bin/env python3
"""Install a proper router that serves static files OR routes to index.php."""
import json, urllib.request

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
url = f'https://app.daytona.io/api/toolbox/{SANDBOX_ID}/toolbox/process/execute'

def run(cmd, timeout=30):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': f'Bearer {DAYTONA_TOKEN}', 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+5) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Write a proper router script that serves static files first
router_php = """<?php
/**
 * Pterodactyl development router for PHP built-in server.
 * Serves static files from /public if they exist, otherwise routes to index.php
 */
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri = urldecode($uri);

// Serve existing static files directly (assets, favicons, etc.)
if ($uri !== '/' && $uri !== '/index.php') {
    $file = __DIR__ . '/public' . $uri;
    if (file_exists($file) && is_file($file)) {
        // Determine MIME type
        $ext = pathinfo($file, PATHINFO_EXTENSION);
        $mimes = [
            'js'   => 'application/javascript; charset=utf-8',
            'css'  => 'text/css; charset=utf-8',
            'json' => 'application/json; charset=utf-8',
            'svg'  => 'image/svg+xml',
            'png'  => 'image/png',
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif'  => 'image/gif',
            'ico'  => 'image/x-icon',
            'woff' => 'font/woff',
            'woff2'=> 'font/woff2',
            'ttf'  => 'font/ttf',
            'eot'  => 'application/vnd.ms-fontobject',
            'woff' => 'font/woff',
            'map'  => 'application/json',
            'txt'  => 'text/plain; charset=utf-8',
            'xml'  => 'application/xml',
        ];
        if (isset($mimes[$ext])) {
            header('Content-Type: ' . $mimes[$ext]);
        }
        header('Cache-Control: public, max-age=31536000, immutable');
        readfile($file);
        return true;
    }
}

// Fall through to Laravel
require_once __DIR__ . '/public/index.php';
"""

write_router = f"""cat > /home/daytona/pterodactyl-panel/server.php << 'ROUTEREOF'
{router_php}ROUTEREOF
echo "ROUTER_WRITTEN"
"""
print("=== Write new router ===")
print(run(write_router))

# Restart PHP server
print("\n=== Restart PHP server ===")
print(run("""pkill -f 'php8.4 -S' 2>/dev/null; sleep 2
cd /home/daytona/pterodactyl-panel
nohup php8.4 -S 0.0.0.0:8000 /home/daytona/pterodactyl-panel/server.php > /tmp/php-server.log 2>&1 &
disown
sleep 3
ss -tlnp | grep :8000
echo "===local test==="
curl -s -o /dev/null -w "bundle: HTTP:%{http_code} SIZE:%{size_download} TYPE:%{content_type}\\n" http://127.0.0.1:8000/assets/bundle.bae76759.js
curl -s -o /dev/null -w "auth: HTTP:%{http_code} SIZE:%{size_download}\\n" http://127.0.0.1:8000/assets/auth.96e17f54.js
curl -s -o /dev/null -w "favicon: HTTP:%{http_code} SIZE:%{size_download}\\n" http://127.0.0.1:8000/favicons/favicon.ico
curl -s -o /dev/null -w "home: HTTP:%{http_code} SIZE:%{size_download}\\n" http://127.0.0.1:8000/
curl -s -o /dev/null -w "manifest: HTTP:%{http_code} SIZE:%{size_download}\\n" http://127.0.0.1:8000/assets/manifest.json
"""))
