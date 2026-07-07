#!/usr/bin/env python3
"""Fix Wings auth - remove quotes from token in config."""
import json, urllib.request, base64

DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22'
SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15'
API_URL = 'https://app.daytona.io/api/toolbox/' + SANDBOX_ID + '/toolbox/process/execute'

def run(cmd, timeout=30):
    body = json.dumps({'command': cmd, 'cwd': '/home/daytona', 'timeout': timeout}).encode()
    req = urllib.request.Request(API_URL, data=body, method='POST', headers={
        'Authorization': 'Bearer ' + DAYTONA_TOKEN, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=timeout+10) as r:
        return json.loads(r.read().decode()).get('result', 'no result')

# Step 1: Get token from DB
print("=== Step 1: Get token from DB ===")
tinker_cmd = "cd /home/daytona/pterodactyl-panel && php artisan tinker --execute='use Pterodactyl\\\\Models\\\\Node; $n = Node::first(); echo $n->daemon_token_id . \"\\n\"; echo $n->getDecryptedKey() . \"\\n\";' 2>&1 | grep -v Deprecated"
out = run(tinker_cmd)
print(out)
lines = [l.strip() for l in out.strip().split('\n') if l.strip() and not l.startswith('Deprecated')]
token_id = lines[0] if len(lines) > 0 else ""
token = lines[1] if len(lines) > 1 else ""
print("Token ID: " + token_id)
print("Token (first 30): " + token[:30] + "...")

# Step 2: Build config
config_lines = [
    'debug: false',
    'app_name: Pterodactyl',
    'uuid: ""',
    'token_id: ' + token_id,
    'token: ' + token,
    'api:',
    '  host: 127.0.0.1',
    '  port: 8080',
    '  ssl:',
    '    enabled: false',
    '    cert: ""',
    '    key: ""',
    '  disable_remote_download: false',
    '  upload_limit: 100',
    '  trusted_proxies: []',
    'system:',
    '  root_directory: /var/lib/pterodactyl',
    '  log_directory: /var/log/pterodactyl',
    '  data: /var/lib/pterodactyl/volumes',
    '  archive_directory: /var/lib/pterodactyl/archives',
    '  backup_directory: /var/lib/pterodactyl/backups',
    '  tmp_directory: /tmp/pterodactyl',
    '  username: pterodactyl',
    '  timezone: UTC',
    '  user:',
    '    rootless:',
    '      enabled: false',
    '      container_uid: 0',
    '      container_gid: 0',
    '    uid: 999',
    '    gid: 986',
    '  passwd:',
    '    enabled: false',
    '    directory: /run/wings/etc',
    '  machine_id:',
    '    enabled: true',
    '    directory: /run/wings/machine-id',
    '  disk_check_interval: 150',
    '  activity_send_interval: 60',
    '  activity_send_count: 100',
    '  check_permissions_on_boot: true',
    '  enable_log_rotate: true',
    '  websocket_log_count: 150',
    '  sftp:',
    '    bind_address: 0.0.0.0',
    '    bind_port: 2022',
    '    read_only: false',
    '  crash_detection:',
    '    enabled: true',
    '    detect_clean_exit_as_crash: true',
    '    timeout: 60',
    '  backups:',
    '    write_limit: 0',
    '    compression_level: best_speed',
    '    restore_host_allowlist: []',
    '  transfers:',
    '    download_limit: 0',
    '  openat_mode: auto',
    'docker:',
    '  network:',
    '    interface: 172.18.0.1',
    '    dns:',
    '    - 1.1.1.1',
    '    - 1.0.0.1',
    '    name: pterodactyl_nw',
    '    ispn: false',
    '    driver: bridge',
    '    network_mode: pterodactyl_nw',
    '    is_internal: false',
    '    enable_icc: true',
    '    network_mtu: 1500',
    '    interfaces:',
    '      v4:',
    '        subnet: 172.18.0.0/16',
    '        gateway: 172.18.0.1',
    '      v6:',
    '        subnet: fdba:17c8:6c94::/64',
    '        gateway: fdba:17c8:6c94::1011',
    '  domainname: ""',
    '  registries: {}',
    '  tmpfs_size: 100',
    '  container_pid_limit: 512',
    '  installer_limits:',
    '    memory: 1024',
    '    cpu: 100',
    '  overhead:',
    '    override: false',
    '    default_multiplier: 1.05',
    '    multipliers: {}',
    '  use_performant_inspect: true',
    '  userns_mode: ""',
    '  log_config:',
    '    type: local',
    '    config:',
    '      compress: "false"',
    '      max-file: "1"',
    '      max-size: 5m',
    '      mode: non-blocking',
    'throttles:',
    '  enabled: true',
    '  lines: 2000',
    '  line_reset_interval: 100',
    'remote: http://127.0.0.1:8000',
    'remote_query:',
    '  timeout: 30',
    '  boot_servers_per_page: 50',
    'allowed_mounts: []',
    'allowed_origins:',
    '  - "*"',
    'allow_cors_private_network: true',
    'ignore_panel_config_updates: false',
    '',
]
config_content = '\n'.join(config_lines)
config_b64 = base64.b64encode(config_content.encode()).decode()

# Step 3: Write config
print("\n=== Step 2: Write Wings config (no quotes on token) ===")
write_cmd = 'echo ' + config_b64 + ' | base64 -d | sudo tee /etc/pterodactyl/config.yml > /dev/null && echo "---verify---" && grep -E "^(token_id|token):" /etc/pterodactyl/config.yml'
print(run(write_cmd, timeout=15))

# Step 4: Restart Wings
print("\n=== Step 3: Restart Wings ===")
restart_cmd = "pkill -f 'wings --config' 2>/dev/null; sleep 3; nohup sudo setsid /usr/local/bin/wings --config /etc/pterodactyl/config.yml > /tmp/wings.log 2>&1 & disown; sleep 8; ps aux | grep 'wings --config' | grep -v grep | head -1; echo '---log---'; tail -10 /tmp/wings.log"
print(run(restart_cmd, timeout=30))

# Step 5: Test auth
print("\n=== Step 4: Test auth ===")
test_cmd = 'TOKEN_ID="' + token_id + '"; TOKEN="' + token + '"; curl -s -o /dev/null -w "Bearer TOKEN_ID.TOKEN: HTTP:%{http_code}\\n" --max-time 5 -H "Authorization: Bearer $TOKEN_ID.$TOKEN" "http://127.0.0.1:8080/api/system"; curl -s -o /dev/null -w "Bearer TOKEN:        HTTP:%{http_code}\\n" --max-time 5 -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:8080/api/system"; echo "---response---"; curl -s --max-time 5 -H "Authorization: Bearer $TOKEN_ID.$TOKEN" "http://127.0.0.1:8080/api/system"'
print(run(test_cmd, timeout=15))
