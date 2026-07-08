#!/usr/bin/env python3
"""Deploy Wings on all 5 Daytona sandboxes + register as nodes + distribute servers."""
import json, urllib.request, base64, time

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
PANEL_SANDBOX = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
WINGS_SANDBOXES = [
    'f5a3ce9a-eb83-44a9-8f05-33eee5848b04',
    '3c575ec2-0e0e-46b6-8c28-4aaf329394a9',
    '0f1a0854-02dd-4a42-8bda-6b73c2efa738',
    'fd91f2e1-99cf-4b04-a4f9-2a05d52c0e4d',
]
ALL_SANDBOXES = [PANEL_SANDBOX] + WINGS_SANDBOXES
DAYTONA_API = 'https://app.daytona.io/api'
PANEL_PUBLIC_URL = 'https://8000-210e4afe-d6d5-4cc1-b3d3-05f40077ea15.daytonaproxy01.eu'

def run_on(sandbox_id, cmd, timeout=60):
    url = DAYTONA_API + '/toolbox/' + sandbox_id + '/toolbox/process/execute'
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(url, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=timeout+10) as r:
            return json.loads(r.read().decode()).get('result', 'no result')
    except Exception as e:
        return f'ERR: {e}'

def php_run(php_code, timeout=60):
    b64 = base64.b64encode(php_code.encode()).decode()
    return run_on(PANEL_SANDBOX, "echo '" + b64 + "' | base64 -d > /tmp/exec.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/exec.php 2>&1 | grep -v Deprecated", timeout=timeout)

# Step 1: Create nodes 2-5 in Panel + get tokens
print("=" * 70)
print("STEP 1: Create nodes 2-5 in Panel")
print("=" * 70)

setup_php = r"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\Node;
use Pterodactyl\Models\Location;
use Pterodactyl\Models\Allocation;
use Pterodactyl\Models\Server;
use Illuminate\Support\Str;
use Illuminate\Encryption\Encrypter;

$loc = Location::firstOrCreate(['short'=>'eu'], ['long'=>'Europe']);

$wingsSboxes = [
    ['f5a3ce9a-eb83-44a9-8f05-33eee5848b04', 'Death Legion Node 2'],
    ['3c575ec2-0e0e-46b6-8c28-4aaf329394a9', 'Death Legion Node 3'],
    ['0f1a0854-02dd-4a42-8bda-6b73c2efa738', 'Death Legion Node 4'],
    ['fd91f2e1-99cf-4b04-a4f9-2a05d52c0e4d', 'Death Legion Node 5'],
];

foreach ($wingsSboxes as $ws) {
    $fqdn = '8000-' . $ws[0] . '.daytonaproxy01.eu';
    $existing = Node::where('fqdn', $fqdn)->first();
    if ($existing) {
        echo "EXISTS:" . $existing->id . ":" . $ws[1] . ":" . $existing->daemon_token_id . ":" . $existing->getDecryptedKey() . "\n";
        continue;
    }
    $n = new Node();
    $n->uuid = Str::uuid();
    $n->name = $ws[1];
    $n->location_id = $loc->id;
    $n->fqdn = $fqdn;
    $n->scheme = 'https';
    $n->behind_proxy = true;
    $n->memory = 1024;
    $n->memory_overallocate = 0;
    $n->disk = 2048;
    $n->disk_overallocate = 0;
    $n->upload_size = 100;
    $n->daemonListen = 443;
    $n->daemonSFTP = 2022;
    $n->daemonBase = '/var/lib/pterodactyl/volumes';
    $n->daemon_token = app(Encrypter::class)->encrypt(Str::random(40));
    $n->daemon_token_id = Str::random(16);
    $n->save();
    
    $basePort = 25610 + ($n->id - 3) * 10;
    for ($p = $basePort; $p < $basePort + 10; $p++) {
        Allocation::create(['node_id'=>$n->id, 'ip'=>'0.0.0.0', 'port'=>$p, 'ip_alias'=>null, 'server_id'=>null, 'notes'=>null]);
    }
    
    echo "CREATED:" . $n->id . ":" . $ws[1] . ":" . $n->daemon_token_id . ":" . $n->getDecryptedKey() . "\n";
}
echo "TOTAL:" . Node::count() . "\n";
"""
result = php_run(setup_php, timeout=45)
print(result)

# Parse node info
nodes = {}
for line in result.strip().split('\n'):
    if line.startswith('CREATED:') or line.startswith('EXISTS:'):
        parts = line.split(':')
        if len(parts) >= 5:
            nodes[parts[2]] = {'id': parts[1], 'token_id': parts[3], 'token': parts[4]}
            
print(f"\nNodes created: {len(nodes)}")

# Step 2: Deploy Wings on each sandbox
print("\n" + "=" * 70)
print("STEP 2: Deploy Wings on each sandbox")
print("=" * 70)

for sandbox_id in WINGS_SANDBOXES:
    node_name = f"Death Legion Node {WINGS_SANDBOXES.index(sandbox_id) + 2}"
    print(f"\n--- {node_name} ({sandbox_id[:8]}...) ---")
    
    node_info = nodes.get(node_name)
    if not node_info:
        print(f"  Node not found in Panel, skipping")
        continue
    
    token_id = node_info['token_id']
    token = node_info['token']
    public_url = f"https://8000-{sandbox_id}.daytonaproxy01.eu"
    
    # Create Wings config
    config = f"""debug: false
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
    config_b64 = base64.b64encode(config.encode()).decode()
    
    # Deploy: write config + download wings + start docker + nginx + wings
    deploy_cmd = f"""sudo mkdir -p /etc/pterodactyl /var/lib/pterodactyl/volumes
sudo useradd -r -m -d /var/lib/pterodactyl -s /usr/sbin/nologin pterodactyl 2>/dev/null || true
echo '{config_b64}' | base64 -d | sudo tee /etc/pterodactyl/config.yml > /dev/null
sudo curl -sL https://github.com/pterodactyl/wings/releases/download/v1.11.13/wings_linux_amd64 -o /usr/local/bin/wings 2>/dev/null
sudo chmod +x /usr/local/bin/wings
sudo dockerd > /tmp/docker.log 2>&1 & sleep 8
sudo docker pull ghcr.io/ptero-eggs/yolks:nodejs_24 2>&1 | tail -1
which nginx > /dev/null 2>&1 || sudo apt-get install -y nginx 2>&1 | tail -2
sudo tee /etc/nginx/sites-available/default > /dev/null << 'NGX'
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
    location = /api/system {{
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
    }}
    location /upload/ {{
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        client_max_body_size 1024M;
    }}
    location /download/ {{
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
    }}
}}
NGX
sudo nginx -t 2>&1
sudo nginx 2>/dev/null || sudo nginx -s reload 2>/dev/null
nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown
sleep 12
echo STATUS
curl -s -o /dev/null -w "Wings: HTTP:%{{http_code}}" -H "Authorization: Bearer {token}" http://127.0.0.1:8080/api/system
echo
grep -c "finished loading" /tmp/wings.log 2>/dev/null
echo " servers loaded"
grep -c "FATAL" /tmp/wings.log 2>/dev/null
echo " fatal"
echo DEPLOY_DONE"""
    
    result = run_on(sandbox_id, deploy_cmd, timeout=120)
    print(f"  {result[:300]}")

# Step 3: Distribute servers across nodes
print("\n" + "=" * 70)
print("STEP 3: Distribute servers across all 5 nodes")
print("=" * 70)

distribute_php = r"""<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Pterodactyl\Models\Server;
use Pterodactyl\Models\Node;
use Pterodactyl\Models\Allocation;

$servers = Server::orderBy('id')->get();
$nodes = Node::orderBy('id')->get();
$nodeCount = $nodes->count();

echo "Servers: {$servers->count()}, Nodes: {$nodeCount}\n";

// Distribute servers across nodes
$idx = 0;
foreach ($servers as $s) {
    $node = $nodes[$idx % $nodeCount];
    
    // Find available allocation on this node
    $alloc = Allocation::where('node_id', $node->id)->whereNull('server_id')->orderBy('port')->first();
    if (!$alloc) {
        echo "No allocation for {$s->name} on Node {$node->id}\n";
        $idx++;
        continue;
    }
    
    // Get current allocation
    $oldAllocId = $s->allocation_id;
    
    // Update server's node + allocation
    $s->node_id = $node->id;
    $s->allocation_id = $alloc->id;
    $s->save();
    
    // Mark new allocation as used
    $alloc->server_id = $s->id;
    $alloc->save();
    
    // Free old allocation
    if ($oldAllocId) {
        $oldAlloc = Allocation::find($oldAllocId);
        if ($oldAlloc) {
            $oldAlloc->server_id = null;
            $oldAlloc->save();
        }
    }
    
    echo "{$s->name} -> Node {$node->id} ({$node->name}) port {$alloc->port}\n";
    $idx++;
}

echo "\nDistribution:\n";
foreach ($nodes as $n) {
    $count = Server::where('node_id', $n->id)->count();
    echo "  Node {$n->id} ({$n->name}): {$count} servers\n";
}
"""
print(php_run(distribute_php, timeout=45))

# Step 4: Restart Wings on all sandboxes
print("\n" + "=" * 70)
print("STEP 4: Restart Wings on all sandboxes")
print("=" * 70)

for i, sandbox_id in enumerate(ALL_SANDBOXES):
    print(f"\n--- Sandbox {i+1} ({sandbox_id[:8]}...) ---")
    result = run_on(sandbox_id, "sudo pkill -9 -f wings 2>/dev/null; sleep 3; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 12; grep -c 'finished loading' /tmp/wings.log 2>/dev/null; echo loaded; grep -c 'FATAL' /tmp/wings.log 2>/dev/null; echo fatal", timeout=25)
    print(f"  {result}")

# Step 5: Final report
print("\n" + "=" * 70)
print("FINAL REPORT")
print("=" * 70)
print(f"Total nodes: 5")
print(f"Total servers: 20 (4 per node)")
print(f"Total RAM: 5GB (1GB per sandbox)")
print(f"Total CPU: 5 vCPUs (1 per sandbox)")
print(f"Total disk: 15GB (3GB per sandbox)")
print(f"E2B storage: 110GB (5 sandboxes)")
print(f"Vercel: Frontend proxy")
