#!/usr/bin/env python3
"""Deploy Wings on all 4 new Daytona sandboxes + register as nodes in Panel."""
import json, urllib.request, base64, time, subprocess

E2B_API_KEY = 'e2b_1f9efe2fb912240566b001e41fcfc5a7b786f8e3'
DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
PANEL_SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
DAYTONA_API = 'https://app.daytona.io/api'
PANEL_PUBLIC_URL = 'https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'

WINGS_SANDBOXES = [
    'f5a3ce9a-eb83-44a9-8f05-33eee5848b04',
    '3c575ec2-0e0e-46b6-8c28-4aaf329394a9',
    '0f1a0854-02dd-4a42-8bda-6b73c2efa738',
    'fd91f2e1-99cf-4b04-a4f9-2a05d52c0e4d',
]

def run_on_sandbox(sandbox_id, cmd, timeout=60):
    url = DAYTONA_API + '/toolbox/' + sandbox_id + '/toolbox/process/execute'
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout+10) as r:
            return json.loads(r.read().decode()).get('result', 'no result')
    except Exception as e:
        return f'ERR: {e}'

def run_on_panel(cmd, timeout=60):
    return run_on_sandbox(PANEL_SANDBOX_ID, cmd, timeout)

def php_run(php_code, timeout=60):
    b64 = base64.b64encode(php_code.encode()).decode()
    return run_on_panel("echo '" + b64 + "' | base64 -d > /tmp/exec.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/exec.php 2>&1 | grep -v Deprecated", timeout=timeout)

# Step 1: Create Nodes in Panel for each Wings sandbox
print("=" * 70)
print("STEP 1: Create Nodes in Panel for each Wings sandbox")
print("=" * 70)

create_nodes_php = r"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\Node;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Allocation;
use Illuminate\Support\Str;
use Illuminate\Encryption\Encrypter;

$location = Location::firstOrCreate(['short' => 'eu'], ['long' => 'Europe']);

$wingsSandboxes = [
    ['f5a3ce9a-eb83-44a9-8f05-33eee5848b04', 'Wings Node 2'],
    ['3c575ec2-0e0e-46b6-8c28-4aaf329394a9', 'Wings Node 3'],
    ['0f1a0854-02dd-4a42-8bda-6b73c2efa738', 'Wings Node 4'],
    ['fd91f2e1-99cf-4b04-a4f9-2a05d52c0e4d', 'Wings Node 5'],
];

foreach ($wingsSandboxes as $ws) {
    $sandboxId = $ws[0];
    $name = $ws[1];
    $fqdn = '8000-' . $sandboxId . '.daytonaproxy01.eu';

    // Check if node already exists
    $existing = Node::where('fqdn', $fqdn)->first();
    if ($existing) {
        echo "Node exists: {$name} (ID: {$existing->id})\n";
        continue;
    }

    $node = new Node();
    $node->name = $name;
    $node->location_id = $location->id;
    $node->fqdn = $fqdn;
    $node->scheme = 'https';
    $node->behind_proxy = true;
    $node->memory = 1024;
    $node->memory_overallocate = 0;
    $node->disk = 2048;
    $node->disk_overallocate = 0;
    $node->upload_size = 100;
    $node->daemonListen = 443;
    $node->daemonSFTP = 2022;
    $node->daemonBase = '/var/lib/pterodactyl/volumes';
    $node->daemon_token = app(Encrypter::class)->encrypt(Str::random(40));
    $node->daemon_token_id = Str::random(16);
    $node->save();

    // Create allocations (4 servers per node, ports 25600-25620)
    $basePort = 25600 + ($node->id - 1) * 10;
    for ($p = $basePort; $p < $basePort + 10; $p++) {
        Allocation::create([
            'node_id' => $node->id,
            'ip' => '0.0.0.0',
            'port' => $p,
            'ip_alias' => null,
            'server_id' => null,
            'notes' => null,
        ]);
    }

    echo "Created: {$name} (ID: {$node->id}, fqdn: {$fqdn})\n";
    echo "  daemon_token_id: {$node->daemon_token_id}\n";
    
    // Output token for Wings config
    echo "  TOKEN_ID:{$node->daemon_token_id}\n";
    echo "  TOKEN:" . $node->getDecryptedKey() . "\n";
}

echo "\nTotal nodes: " . Node::count() . "\n";
"""
print(php_run(create_nodes_php, timeout=45))

# Step 2: Deploy Wings on each new sandbox
print("\n" + "=" * 70)
print("STEP 2: Deploy Wings on each new Daytona sandbox")
print("=" * 70)

# Get node tokens from Panel DB
nodes_info = run_on_panel("mysql -u pterodactyl -pptero_app_pw_2025 pterodactyl -e 'SELECT id, name, fqdn, daemon_token_id FROM nodes ORDER BY id' 2>/dev/null", timeout=10)
print("Nodes in Panel:")
print(nodes_info)

# For each Wings sandbox, deploy Wings
for i, sandbox_id in enumerate(WINGS_SANDBOXES):
    node_num = i + 2
    public_url = f"https://8000-{sandbox_id}.daytonaproxy01.eu"
    print(f"\n--- Deploying Wings on Node {node_num} ({sandbox_id[:8]}...) ---")
    
    # Get the daemon token for this node
    get_token_php = f"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Pterodactyl\\Models\\Node;
$nodes = Node::where('name', 'Wings Node {node_num}')->get();
foreach ($nodes as $n) {{
    echo $n->daemon_token_id . "\\n" . $n->getDecryptedKey() . "\\n";
}}
"""
    b64 = base64.b64encode(get_token_php.encode()).decode()
    token_result = run_on_panel(f"echo '{b64}' | base64 -d > /tmp/gt.php && cd /home/daytona/pterodactyl-panel && php /tmp/gt.php 2>&1 | grep -v Deprecated", timeout=15)
    token_lines = token_result.strip().split('\n')
    token_id = token_lines[0].strip() if token_lines else ''
    token = token_lines[1].strip() if len(token_lines) > 1 else ''
    
    if not token_id or not token:
        print(f"  Failed to get token for Node {node_num}")
        continue
    
    print(f"  Token ID: {token_id}")
    
    # Write Wings config
    wings_config = f"""debug: false
app_name: Pterodactyl
uuid: ""
token_id: {token_id}
token: {token}
api:
  host: 127.0.0.1
  port: 8080
  ssl:
    enabled: false
    cert: ""
    key: ""
  disable_remote_download: false
  upload_limit: 100
  trusted_proxies: []
system:
  root_directory: /var/lib/pterodactyl
  log_directory: /var/log/pterodactyl
  data: /var/lib/pterodactyl/volumes
  archive_directory: /var/lib/pterodactyl/archives
  backup_directory: /var/lib/pterodactyl/backups
  tmp_directory: /tmp/pterodactyl
  username: pterodactyl
  timezone: UTC
  user:
    rootless:
      enabled: false
      container_uid: 0
      container_gid: 0
    uid: 999
    gid: 986
  disk_check_interval: 150
  activity_send_interval: 60
  activity_send_count: 100
  check_permissions_on_boot: true
  enable_log_rotate: true
  websocket_log_count: 150
  sftp:
    bind_address: 0.0.0.0
    bind_port: 2022
    read_only: false
  crash_detection:
    enabled: true
    detect_clean_exit_as_crash: true
    timeout: 60
  backups:
    write_limit: 0
    compression_level: best_speed
    restore_host_allowlist: []
  transfers:
    download_limit: 0
  openat_mode: auto
docker:
  network:
    interface: 172.18.0.1
    dns:
    - 1.1.1.1
    - 1.0.0.1
    name: pterodactyl_nw
    ispn: false
    driver: bridge
    network_mode: pterodactyl_nw
    is_internal: false
    enable_icc: true
    network_mtu: 1500
    interfaces:
      v4:
        subnet: 172.18.0.0/16
        gateway: 172.18.0.1
      v6:
        subnet: fdba:17c8:6c94::/64
        gateway: fdba:17c8:6c94::1011
  domainname: ""
  registries: {{}}
  tmpfs_size: 100
  container_pid_limit: 512
  installer_limits:
    memory: 1024
    cpu: 100
  overhead:
    override: false
    default_multiplier: 1.05
    multipliers: {{}}
  use_performant_inspect: true
  userns_mode: ""
  log_config:
    type: local
    config:
      compress: "false"
      max-file: "1"
      max-size: 5m
      mode: non-blocking
throttles:
  enabled: true
  lines: 2000
  line_reset_interval: 100
remote: {PANEL_PUBLIC_URL}
remote_query:
  timeout: 30
  boot_servers_per_page: 50
allowed_mounts: []
allowed_origins:
  - "*"
allow_cors_private_network: true
ignore_panel_config_updates: false
"""
    config_b64 = base64.b64encode(wings_config.encode()).decode()
    
    # Deploy Wings on the sandbox
    deploy_cmd = f"""# Install Wings + Docker + nginx
echo "Setting up Wings on {sandbox_id[:8]}..."

# Create directories
sudo mkdir -p /etc/pterodactyl /var/lib/pterodactyl/volumes /var/lib/pterodactyl/archives /var/lib/pterodactyl/backups

# Write Wings config
echo '{config_b64}' | base64 -d | sudo tee /etc/pterodactyl/config.yml > /dev/null

# Download Wings binary
sudo curl -sL https://github.com/pterodactyl/wings/releases/download/v1.11.13/wings_linux_amd64 -o /usr/local/bin/wings
sudo chmod +x /usr/local/bin/wings

# Create pterodactyl user
sudo useradd -r -m -d /var/lib/pterodactyl -s /usr/sbin/nologin pterodactyl 2>/dev/null || true

# Start Docker
sudo dockerd > /tmp/docker.log 2>&1 &
sleep 5

# Pull Docker image
sudo docker pull ghcr.io/ptero-eggs/yolks:nodejs_24 2>&1 | tail -2

# Write nginx config to proxy Wings on port 8000 -> 8080
sudo tee /etc/nginx/sites-available/wings.conf > /dev/null << 'NGINX'
server {{
    listen 8000 default_server;
    server_name _;
    client_max_body_size 1024M;
    location ~ ^/api/servers/([^/]+)/ws$ {{
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400s;
    }}
    location / {{
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }}
}}
NGINX

# Install + start nginx
which nginx || sudo apt-get install -y nginx 2>&1 | tail -3
sudo ln -sf /etc/nginx/sites-available/wings.conf /etc/nginx/sites-enabled/wings.conf
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t 2>&1
sudo nginx 2>/dev/null || sudo nginx -s reload 2>/dev/null

# Start Wings
nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 &
disown
sleep 10

# Check
echo "=== STATUS ==="
ss -tlnp | grep -E ":8000|:8080" | awk '{print $4}'
grep -c "finished loading" /tmp/wings.log 2>/dev/null
echo " servers loaded"
grep -c "failed to load" /tmp/wings.log 2>/dev/null
echo " servers failed"
curl -s -o /dev/null -w "Wings: HTTP:%{http_code}" -H "Authorization: Bearer {token}" http://127.0.0.1:8080/api/system 2>/dev/null
echo
echo "DEPLOY_DONE"
"""
    result = run_on_sandbox(sandbox_id, deploy_cmd, timeout=120)
    print(f"  Result: {result[:300]}")

# Step 3: Test all nodes
print("\n" + "=" * 70)
print("STEP 3: Test all Wings nodes")
print("=" * 70)

# Get all node info
nodes_test = php_run("""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Pterodactyl\\Models\\Node;
foreach (Node::orderBy('id')->get() as $n) {
    echo $n->id . "|" . $n->name . "|" . $n->fqdn . "|" . $n->daemon_token_id . "|" . $n->getDecryptedKey() . "\\n";
}
""", timeout=15)
print("All nodes:")
for line in nodes_test.strip().split('\n'):
    parts = line.strip().split('|')
    if len(parts) >= 5:
        print(f"  Node {parts[0]}: {parts[1]} -> {parts[2]}")

print("\nDistributed architecture deployment complete!")
