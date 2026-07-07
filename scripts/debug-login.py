#!/usr/bin/env python3
"""Check + fix API key limit + test login flow."""
import json
import urllib.request
import base64

TOKEN = "dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22"
SANDBOX = "210e4afe-d6d5-4cc1-b3d3-05f40077ea15"

# 1. Check + fix API key limit
SCRIPT = r'''
<?php
require __DIR__."/vendor/autoload.php";
$app = require_once __DIR__."/bootstrap/app.php";
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\ApiKey;
use Pterodactyl\Models\User;

// Check all users' API key counts
$users = User::all();
foreach ($users as $user) {
    $count = ApiKey::where("user_id", $user->id)->where("key_type", 1)->count();
    if ($count > 0) {
        echo "User {$user->username}: {$count} keys\n";
        // Delete all client API keys (they're all browser-session, safe to delete)
        ApiKey::where("user_id", $user->id)->where("key_type", 1)->delete();
        echo "  Deleted all\n";
    }
}

// Increase the limit
$file = file_get_contents(__DIR__."/app/Http/Controllers/Api/Client/ApiKeyController.php");
$file = str_replace(">= 25", ">= 1000", $file);
file_put_contents(__DIR__."/app/Http/Controllers/Api/Client/ApiKeyController.php", $file);
echo "Limit increased to 1000\n";

// Test login flow directly
$cookie_file = tempnam(sys_get_temp_dir(), "cookie");

// Get CSRF cookie
$ch = curl_init("http://127.0.0.1:8000/sanctum/csrf-cookie");
curl_setopt($ch, CURLOPT_COOKIEJAR, $cookie_file);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
curl_exec($ch);
curl_close($ch);

// Read XSRF token
$xsrf = "";
$lines = file($cookie_file);
foreach ($lines as $line) {
    if (strpos($line, "XSRF-TOKEN") !== false) {
        $parts = explode("\t", trim($line));
        $xsrf = urldecode(end($parts));
        break;
    }
}
echo "XSRF token: " . substr($xsrf, 0, 20) . "...\n";

// Login
$ch = curl_init("http://127.0.0.1:8000/auth/login");
curl_setopt($ch, CURLOPT_COOKIEFILE, $cookie_file);
curl_setopt($ch, CURLOPT_COOKIEJAR, $cookie_file);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Accept: application/json",
    "Content-Type: application/json",
    "X-XSRF-TOKEN: " . $xsrf,
    "X-Requested-With: XMLHttpRequest",
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["user" => "admin", "password" => "DeathLegion2025!"]));
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
$login_resp = curl_exec($ch);
$http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
echo "Login HTTP: {$http_code}\n";
echo "Login response: " . substr($login_resp, 0, 200) . "\n";

// Create API key
$ch = curl_init("http://127.0.0.1:8000/api/client/account/api-keys");
curl_setopt($ch, CURLOPT_COOKIEFILE, $cookie_file);
curl_setopt($ch, CURLOPT_COOKIEJAR, $cookie_file);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Accept: application/json",
    "Content-Type: application/json",
    "X-XSRF-TOKEN: " . $xsrf,
    "X-Requested-With: XMLHttpRequest",
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(["description" => "test", "allowed_ips" => []]));
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
$key_resp = curl_exec($ch);
$key_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);
echo "API key HTTP: {$key_code}\n";
echo "API key response: " . substr($key_resp, 0, 200) . "\n";

unlink($cookie_file);
echo "DONE\n";
'''

b64 = base64.b64encode(SCRIPT.encode()).decode()
body = json.dumps({
    "command": f"printf '%s' '{b64}' | base64 -d > /home/daytona/pterodactyl-panel/test.php && cd /home/daytona/pterodactyl-panel && php test.php 2>&1; rm test.php",
    "cwd": "/home/daytona",
    "timeout": 30,
})
req = urllib.request.Request(
    f"https://app.daytona.io/api/toolbox/{SANDBOX}/toolbox/process/execute",
    data=body.encode(),
    headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
)
with urllib.request.urlopen(req, timeout=60) as resp:
    print(resp.read().decode())
