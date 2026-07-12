import type { VercelRequest, VercelResponse } from '@vercel/node';
import { mysqlQuery, mysqlQueryJson, sqlEscape, verifyAdmin, logAdminAction } from './_admin';

/**
 * Admin API — all CRUD operations
 * POST /api/admin-api?action=create_user
 * POST /api/admin-api?action=delete_user
 * POST /api/admin-api?action=suspend_user
 * POST /api/admin-api?action=edit_user
 * POST /api/admin-api?action=delete_server
 * POST /api/admin-api?action=server_power
 * POST /api/admin-api?action=create_node
 * POST /api/admin-api?action=delete_node
 * POST /api/admin-api?action=add_allocation
 * POST /api/admin-api?action=delete_allocation
 * POST /api/admin-api?action=announcement
 * POST /api/admin-api?action=ban_ip
 * POST /api/admin-api?action=adjust_credits
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-XSRF-TOKEN');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify admin
  const admin = await verifyAdmin(req);
  if (!admin) {
    return res.status(403).json({ error: 'access_denied', error_description: 'Admin access required' });
  }

  const action = (req.query.action as string) || (req.body?.action as string);
  const body = req.body || {};

  try {
    switch (action) {
      // === USER MANAGEMENT ===
      case 'create_user': {
        const { username, email, password, name_first, name_last, root_admin } = body;
        if (!username || !email || !password) return res.status(400).json({ error: 'username, email, password required' });
        if (password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });

        // Check if exists
        const existing = await mysqlQueryJson(`SELECT id FROM users WHERE username='${sqlEscape(username)}' OR email='${sqlEscape(email)}' LIMIT 1`);
        if (existing[0]) return res.status(400).json({ error: 'Username or email already exists' });

        // Create user via PHP (need bcrypt)
        const phpScript = `<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Pterodactyl\\Services\\Users\\UserCreationService;
$svc = app(UserCreationService::class);
$user = $svc->handle([
    'email' => '${sqlEscape(email)}', 'username' => '${sqlEscape(username)}',
    'name_first' => '${sqlEscape(name_first || username)}', 'name_last' => '${sqlEscape(name_last || 'Legion')}',
    'password' => '${sqlEscape(password)}', 'root_admin' => ${root_admin ? 1 : 0}, 'language' => 'en',
]);
echo $user->id;
`;
        const b64 = Buffer.from(phpScript).toString('base64');
        const daytonaToken = process.env.DAYTONA_TOKEN || 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
        const resp = await fetch(`https://app.daytona.io/api/16551277-c744-47d8-bbf4-f681442b1691/toolbox/process/execute`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${daytonaToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: `echo '${b64}' | base64 -d > /tmp/admin_create.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/admin_create.php 2>&1 | grep -v Deprecated`, cwd: '/home/daytona', timeout: 30 }),
        });
        const data = await resp.json() as any;
        const userId = parseInt(data.result?.trim() || '0');
        if (!userId) return res.status(500).json({ error: 'Failed to create user', detail: data.result });

        await logAdminAction(admin.id, 'create_user', `Created user ${username} (${email})`);
        return res.status(201).json({ success: true, userId, username, email });
      }

      case 'edit_user': {
        const { user_id, email, name_first, name_last, root_admin, password } = body;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });
        const sets: string[] = [];
        if (email) sets.push(`email='${sqlEscape(email)}'`);
        if (name_first) sets.push(`name_first='${sqlEscape(name_first)}'`);
        if (name_last) sets.push(`name_last='${sqlEscape(name_last)}'`);
        if (root_admin !== undefined) sets.push(`root_admin=${root_admin ? 1 : 0}`);
        if (sets.length > 0) await mysqlQuery(`UPDATE users SET ${sets.join(', ')} WHERE id=${parseInt(user_id)}`);

        // Password change via PHP (bcrypt)
        if (password && password.length >= 8) {
          const phpScript = `<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Pterodactyl\\Models\\User;
$u = User::find(${parseInt(user_id)});
if ($u) { $u->password = '${sqlEscape(password)}'; $u->save(); echo 'OK'; }
`;
          const b64 = Buffer.from(phpScript).toString('base64');
          const daytonaToken = process.env.DAYTONA_TOKEN || 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
          await fetch(`https://app.daytona.io/api/16551277-c744-47d8-bbf4-f681442b1691/toolbox/process/execute`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${daytonaToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ command: `echo '${b64}' | base64 -d > /tmp/admin_pw.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/admin_pw.php 2>&1`, cwd: '/home/daytona', timeout: 15 }),
          });
        }
        await logAdminAction(admin.id, 'edit_user', `Edited user ID ${user_id}`);
        return res.status(200).json({ success: true });
      }

      case 'delete_user': {
        const { user_id } = body;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });
        if (parseInt(user_id) === 1) return res.status(400).json({ error: 'Cannot delete primary admin' });
        // Delete user's servers first
        await mysqlQuery(`DELETE FROM servers WHERE owner_id=${parseInt(user_id)}`);
        await mysqlQuery(`DELETE FROM api_keys WHERE user_id=${parseInt(user_id)}`);
        await mysqlQuery(`DELETE FROM users WHERE id=${parseInt(user_id)}`);
        await logAdminAction(admin.id, 'delete_user', `Deleted user ID ${user_id}`);
        return res.status(200).json({ success: true });
      }

      case 'suspend_user': {
        const { user_id, suspend } = body;
        if (!user_id) return res.status(400).json({ error: 'user_id required' });
        // Pterodactyl uses 'status' field on users? Actually uses a separate suspended flag
        // We'll set it via the model
        const phpScript = `<?php
require '/home/daytona/pterodactyl-panel/vendor/autoload.php';
$app = require '/home/daytona/pterodactyl-panel/bootstrap/app.php';
$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap();
use Pterodactyl\\Models\\User;
$u = User::find(${parseInt(user_id)});
if ($u) { $u->status = '${suspend ? 'suspended' : 'active'}'; $u->save(); echo 'OK'; }
`;
        const b64 = Buffer.from(phpScript).toString('base64');
        const daytonaToken = process.env.DAYTONA_TOKEN || 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
        await fetch(`https://app.daytona.io/api/16551277-c744-47d8-bbf4-f681442b1691/toolbox/process/execute`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${daytonaToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: `echo '${b64}' | base64 -d > /tmp/admin_susp.php && cd /home/daytona/pterodactyl-panel && sudo php /tmp/admin_susp.php 2>&1`, cwd: '/home/daytona', timeout: 15 }),
        });
        await logAdminAction(admin.id, 'suspend_user', `${suspend ? 'Suspended' : 'Unsuspended'} user ID ${user_id}`);
        return res.status(200).json({ success: true });
      }

      // === SERVER MANAGEMENT ===
      case 'delete_server': {
        const { server_id } = body;
        if (!server_id) return res.status(400).json({ error: 'server_id required' });
        await mysqlQuery(`DELETE FROM servers WHERE id=${parseInt(server_id)}`);
        await logAdminAction(admin.id, 'delete_server', `Deleted server ID ${server_id}`);
        return res.status(200).json({ success: true });
      }

      case 'server_power': {
        const { server_uuid, signal } = body;
        if (!server_uuid || !signal) return res.status(400).json({ error: 'server_uuid and signal required' });
        // Send power signal via panel API using admin cookies
        const cookieHeader = (req.headers['cookie'] as string) || '';
        const xsrfToken = (req.headers['x-xsrf-token'] as string) || '';
        const resp = await fetch(`https://deathlegionpanel.vercel.app/api/client/servers/${server_uuid}/power`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Cookie': cookieHeader,
            'X-XSRF-TOKEN': xsrfToken,
          },
          body: JSON.stringify({ signal }),
        });
        await logAdminAction(admin.id, 'server_power', `${signal} server ${server_uuid}`);
        return res.status(200).json({ success: true, status: resp.status });
      }

      case 'edit_server': {
        const { server_id, name, owner_id, memory, disk, cpu, suspended } = body;
        if (!server_id) return res.status(400).json({ error: 'server_id required' });
        const sets: string[] = [];
        if (name) sets.push(`name='${sqlEscape(name)}'`);
        if (owner_id) sets.push(`owner_id=${parseInt(owner_id)}`);
        if (memory) sets.push(`memory=${parseInt(memory)}`);
        if (disk) sets.push(`disk=${parseInt(disk)}`);
        if (cpu) sets.push(`cpu=${parseInt(cpu)}`);
        if (suspended !== undefined) sets.push(`suspended=${suspended ? 1 : 0}`);
        if (sets.length > 0) await mysqlQuery(`UPDATE servers SET ${sets.join(', ')} WHERE id=${parseInt(server_id)}`);
        await logAdminAction(admin.id, 'edit_server', `Edited server ID ${server_id}`);
        return res.status(200).json({ success: true });
      }

      // === NODE MANAGEMENT ===
      case 'create_node': {
        const { name, fqdn, daemon_listen, daemon_sftp } = body;
        if (!name || !fqdn) return res.status(400).json({ error: 'name and fqdn required' });
        const locationId = 1;
        await mysqlQuery(`INSERT INTO nodes (name, location_id, fqdn, scheme, daemon_listen, daemon_sftp, daemon_base, memory, memory_overallocate, disk, disk_overallocate, upload_size, daemon_sftp_alias, maintenance_mode, behind_proxy, created_at, updated_at) VALUES ('${sqlEscape(name)}', ${locationId}, '${sqlEscape(fqdn)}', 'https', ${daemon_listen || 8080}, ${daemon_sftp || 2022}, '/var/lib/pterodactyl/volumes', 0, 0, 0, 0, 100, NULL, 0, 1, NOW(), NOW())`);
        await logAdminAction(admin.id, 'create_node', `Created node ${name}`);
        return res.status(201).json({ success: true });
      }

      case 'delete_node': {
        const { node_id } = body;
        if (!node_id) return res.status(400).json({ error: 'node_id required' });
        // Check no servers on this node
        const servers = await mysqlQueryJson(`SELECT COUNT(*) as cnt FROM servers WHERE node_id=${parseInt(node_id)}`);
        if (parseInt(servers[0]?.cnt || '0') > 0) return res.status(400).json({ error: 'Cannot delete node with active servers' });
        await mysqlQuery(`DELETE FROM allocations WHERE node_id=${parseInt(node_id)}`);
        await mysqlQuery(`DELETE FROM nodes WHERE id=${parseInt(node_id)}`);
        await logAdminAction(admin.id, 'delete_node', `Deleted node ID ${node_id}`);
        return res.status(200).json({ success: true });
      }

      case 'add_allocation': {
        const { node_id, ip, ports_start, ports_end } = body;
        if (!node_id || !ip || !ports_start) return res.status(400).json({ error: 'node_id, ip, ports_start required' });
        const end = ports_end || ports_start;
        let count = 0;
        for (let p = parseInt(ports_start); p <= parseInt(end); p++) {
          await mysqlQuery(`INSERT INTO allocations (node_id, ip, port, alias, server_id) VALUES (${parseInt(node_id)}, '${sqlEscape(ip)}', ${p}, NULL, NULL)`);
          count++;
        }
        await logAdminAction(admin.id, 'add_allocation', `Added ${count} allocations to node ${node_id}`);
        return res.status(201).json({ success: true, count });
      }

      case 'delete_allocation': {
        const { allocation_id } = body;
        if (!allocation_id) return res.status(400).json({ error: 'allocation_id required' });
        const inUse = await mysqlQueryJson(`SELECT server_id FROM allocations WHERE id=${parseInt(allocation_id)} AND server_id IS NOT NULL LIMIT 1`);
        if (inUse[0]) return res.status(400).json({ error: 'Allocation is in use by a server' });
        await mysqlQuery(`DELETE FROM allocations WHERE id=${parseInt(allocation_id)}`);
        return res.status(200).json({ success: true });
      }

      // === ANNOUNCEMENTS ===
      case 'announcement': {
        const { message, active } = body;
        // Store in a settings-like table or create one
        await mysqlQuery(`CREATE TABLE IF NOT EXISTS dl_announcements (id INT PRIMARY KEY AUTO_INCREMENT, message TEXT, active TINYINT DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        if (message) {
          await mysqlQuery(`UPDATE dl_announcements SET active=0`);
          await mysqlQuery(`INSERT INTO dl_announcements (message, active) VALUES ('${sqlEscape(message)}', 1)`);
          await logAdminAction(admin.id, 'announcement', `Set announcement: ${message.substring(0, 50)}`);
        } else if (active === false) {
          await mysqlQuery(`UPDATE dl_announcements SET active=0`);
          await logAdminAction(admin.id, 'announcement', 'Disabled announcements');
        }
        return res.status(200).json({ success: true });
      }

      // === IP BANS ===
      case 'ban_ip': {
        const { ip, reason } = body;
        if (!ip) return res.status(400).json({ error: 'ip required' });
        await mysqlQuery(`CREATE TABLE IF NOT EXISTS dl_ip_bans (id INT PRIMARY KEY AUTO_INCREMENT, ip VARCHAR(45) UNIQUE, reason TEXT, banned_by INT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
        await mysqlQuery(`INSERT IGNORE INTO dl_ip_bans (ip, reason, banned_by) VALUES ('${sqlEscape(ip)}', '${sqlEscape(reason || '')}', ${admin.id})`);
        await logAdminAction(admin.id, 'ban_ip', `Banned IP ${ip}`);
        return res.status(201).json({ success: true });
      }

      case 'unban_ip': {
        const { ip } = body;
        if (!ip) return res.status(400).json({ error: 'ip required' });
        await mysqlQuery(`DELETE FROM dl_ip_bans WHERE ip='${sqlEscape(ip)}'`);
        await logAdminAction(admin.id, 'unban_ip', `Unbanned IP ${ip}`);
        return res.status(200).json({ success: true });
      }

      // === CREDITS ===
      case 'adjust_credits': {
        const { username, amount } = body;
        if (!username || amount === undefined) return res.status(400).json({ error: 'username and amount required' });
        // Call the credits API
        await fetch('https://deathlegionpanel.vercel.app/api/credits?action=add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: username, amount: parseInt(amount), targetUser: username }),
        });
        await logAdminAction(admin.id, 'adjust_credits', `Adjusted ${username} credits by ${amount}`);
        return res.status(200).json({ success: true });
      }

      // === BULK ACTIONS ===
      case 'bulk_suspend': {
        const { user_ids } = body;
        if (!Array.isArray(user_ids)) return res.status(400).json({ error: 'user_ids array required' });
        for (const id of user_ids) {
          if (parseInt(id) !== 1) await mysqlQuery(`UPDATE users SET status='suspended' WHERE id=${parseInt(id)}`);
        }
        await logAdminAction(admin.id, 'bulk_suspend', `Suspended ${user_ids.length} users`);
        return res.status(200).json({ success: true, count: user_ids.length });
      }

      case 'bulk_delete_servers': {
        const { server_ids } = body;
        if (!Array.isArray(server_ids)) return res.status(400).json({ error: 'server_ids array required' });
        for (const id of server_ids) {
          await mysqlQuery(`DELETE FROM servers WHERE id=${parseInt(id)}`);
        }
        await logAdminAction(admin.id, 'bulk_delete_servers', `Deleted ${server_ids.length} servers`);
        return res.status(200).json({ success: true, count: server_ids.length });
      }

      // === LOCATIONS ===
      case 'create_location': {
        const { short, long } = body;
        if (!short || !long) return res.status(400).json({ error: 'short and long required' });
        await mysqlQuery(`INSERT INTO locations (short, long, created_at, updated_at) VALUES ('${sqlEscape(short)}', '${sqlEscape(long)}', NOW(), NOW())`);
        await logAdminAction(admin.id, 'create_location', `Created location ${short}`);
        return res.status(201).json({ success: true });
      }

      case 'delete_location': {
        const { location_id } = body;
        if (!location_id) return res.status(400).json({ error: 'location_id required' });
        const nodes = await mysqlQueryJson(`SELECT COUNT(*) as cnt FROM nodes WHERE location_id=${parseInt(location_id)}`);
        if (parseInt(nodes[0]?.cnt || '0') > 0) return res.status(400).json({ error: 'Cannot delete location with nodes' });
        await mysqlQuery(`DELETE FROM locations WHERE id=${parseInt(location_id)}`);
        await logAdminAction(admin.id, 'delete_location', `Deleted location ID ${location_id}`);
        return res.status(200).json({ success: true });
      }

      // === SETTINGS ===
      case 'save_settings': {
        await mysqlQuery(`CREATE TABLE IF NOT EXISTS dl_settings (\`key\` VARCHAR(255) PRIMARY KEY, value TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`);
        for (const [key, value] of Object.entries(body)) {
          if (key === 'action') continue;
          await mysqlQuery(`INSERT INTO dl_settings (\`key\`, value) VALUES ('${sqlEscape(key)}', '${sqlEscape(String(value))}') ON DUPLICATE KEY UPDATE value='${sqlEscape(String(value))}'`);
        }
        await logAdminAction(admin.id, 'save_settings', `Updated ${Object.keys(body).length - 1} settings`);
        return res.status(200).json({ success: true });
      }

      case 'clear_cache': {
        const { cache_type } = body;
        const daytonaToken = process.env.DAYTONA_TOKEN || '';
        const cacheCmd = cache_type === 'config' ? 'php artisan config:clear' : cache_type === 'route' ? 'php artisan route:clear' : 'php artisan view:clear';
        await fetch(`https://app.daytona.io/api/16551277-c744-47d8-bbf4-f681442b1691/toolbox/process/execute`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${daytonaToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: `cd /home/daytona/pterodactyl-panel && sudo php artisan ${cache_type}:clear 2>&1`, cwd: '/home/daytona', timeout: 30 }),
        });
        await logAdminAction(admin.id, 'clear_cache', `Cleared ${cache_type} cache`);
        return res.status(200).json({ success: true });
      }

      default:
        return res.status(400).json({ error: 'unknown_action', error_description: `Action '${action}' not supported` });
    }
  } catch (e: any) {
    console.error('Admin API error:', e);
    return res.status(500).json({ error: 'server_error', error_description: e?.message || String(e) });
  }
}

export const config = { api: { bodyParser: true, sizeLimit: '10mb' }, maxDuration: 60 };
