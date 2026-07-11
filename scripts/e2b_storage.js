#!/usr/bin/env node
/**
 * Death Legion — Permanent Storage Fix using E2B
 * ===============================================
 * Problem: Panel sandbox has only 3GB disk (96% full). The start_all.sh
 * cleanup script deletes node_modules from server volumes when disk is low,
 * causing bots to lose their installed packages on every restart.
 *
 * Solution: Use E2B sandboxes (22GB each) as:
 * 1. npm install offloader — run npm install on E2B (has more disk + RAM),
 *    then tar + download node_modules to the panel
 * 2. Persistent node_modules cache — keep common node_modules tarballs on E2B
 *    and restore them on server start (faster than reinstalling)
 * 3. Storage extension — offload large/unused server files to E2B
 *
 * Usage:
 *   node scripts/e2b_storage.js install <server_uuid> <package_dir>
 *     → Runs npm install on E2B, syncs node_modules back to the panel
 *
 *   node scripts/e2b_storage.js cache-get <cache_key>
 *     → Downloads a cached node_modules tarball from E2B
 *
 *   node scripts/e2b_storage.js cache-put <cache_key> <local_dir>
 *     → Uploads a directory to E2B as a cached tarball
 *
 *   node scripts/e2b_storage.js sync-volumes
 *     → Syncs ALL server volumes to E2B as backup
 */

const { Sandbox } = require('e2b');
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');
const https = require('https');

const E2B_API_KEY = process.env.E2B_API_KEY || 'e2b_1f9efe2fb912240566b001e41fcfc5a7b786f8e3';
const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
const PANEL_SANDBOX = '16551277-c744-47d8-bbf4-f681442b1691';
const DAYTONA_API = 'https://app.daytona.io/api';

// Persistent E2B sandbox ID — we keep one alive for caching
let persistentSandbox = null;

async function getSandbox() {
  if (persistentSandbox) {
    try {
      // Test if it's still alive
      await persistentSandbox.commands.run('echo alive');
      return persistentSandbox;
    } catch {
      persistentSandbox = null;
    }
  }
  // Pass apiKey directly — required when env var isn't set
  persistentSandbox = await Sandbox.create({ timeout: 3600, apiKey: E2B_API_KEY });
  return persistentSandbox;
}

/** Run a shell command on the Daytona panel sandbox */
function runOnPanel(cmd, timeout = 60) {
  const body = JSON.stringify({ command: cmd, cwd: '/home/daytona', timeout });
  const result = execSync(
    `curl -s -X POST "${DAYTONA_API}/toolbox/${PANEL_SANDBOX}/toolbox/process/execute" ` +
    `-H "Authorization: Bearer ${DAYTONA_TOKEN}" ` +
    `-H "Content-Type: application/json" ` +
    `-d '${body.replace(/'/g, "'\\''")}'`,
    { timeout: (timeout + 10) * 1000, encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 }
  );
  try {
    return JSON.parse(result).result || '';
  } catch {
    return result;
  }
}

/**
 * Run npm install on E2B and sync node_modules back to the panel.
 * This offloads the heavy npm install (disk + RAM) to E2B's 22GB/481MB sandbox.
 */
async function npmInstallOnE2B(volumeUuid, packages = '') {
  console.log(`[E2B] Starting npm install for server ${volumeUuid}...`);
  const sbx = await getSandbox();
  const volumePath = `/var/lib/pterodactyl/volumes/${volumeUuid}`;

  try {
    // Step 1: Read package.json from the panel
    console.log('[E2B] Reading package.json from panel...');
    const pkgJsonContent = runOnPanel(`cat ${volumePath}/package.json 2>/dev/null`, 10);
    if (!pkgJsonContent || pkgJsonContent.includes('No such file')) {
      // No package.json — create a default one
      console.log('[E2B] No package.json found, creating default...');
      const defaultPkg = JSON.stringify({
        name: 'death-legion-bot',
        version: '1.0.0',
        main: 'index.js',
        dependencies: packages ? packages.split(' ').reduce((acc, p) => {
          acc[p] = 'latest';
          return acc;
        }, {}) : {}
      }, null, 2);
      runOnPanel(`cat > ${volumePath}/package.json << 'PKGEOF'\n${defaultPkg}\nPKGEOF`, 10);
    }

    // Step 2: Upload package.json to E2B
    console.log('[E2B] Uploading package.json to E2B...');
    const pkgJson = pkgJsonContent || runOnPanel(`cat ${volumePath}/package.json`, 10);
    await sbx.files.write('/home/user/package.json', pkgJson);

    // Step 3: Run npm install on E2B (has 20GB free disk)
    console.log('[E2B] Running npm install on E2B (22GB disk)...');
    const installResult = await sbx.commands.run(
      `cd /home/user && npm install --production 2>&1 | tail -20`,
      { timeout: 300000 } // 5 min timeout
    );
    console.log('[E2B] npm install stdout:', installResult.stdout.slice(0, 500));

    // Step 4: Tar up node_modules on E2B
    console.log('[E2B] Compressing node_modules...');
    const tarResult = await sbx.commands.run(
      `cd /home/user && tar czf /tmp/node_modules.tar.gz node_modules 2>&1 && ls -lh /tmp/node_modules.tar.gz`,
      { timeout: 120000 }
    );
    console.log('[E2B] Tar result:', tarResult.stdout.slice(0, 200));

    // Step 5: Download the tarball from E2B
    console.log('[E2B] Downloading node_modules.tar.gz from E2B...');
    const tarball = await sbx.files.read('/tmp/node_modules.tar.gz', 'bytes');

    // Step 6: Upload to panel via base64 (small chunks to avoid E2BIG)
    console.log('[E2B] Uploading to panel...');
    const b64 = Buffer.from(tarball).toString('base64');
    const chunkSize = 500000; // 50KB chunks — shell command line safe
    const chunks = Math.ceil(b64.length / chunkSize);
    const totalMB = (tarball.length / 1024 / 1024).toFixed(1);

    runOnPanel(`rm -f /tmp/node_modules.tar.gz`, 5);
    for (let i = 0; i < chunks; i++) {
      const chunk = b64.slice(i * chunkSize, (i + 1) * chunkSize);
      const append = i > 0 ? '>>' : '>';
      runOnPanel(`echo '${chunk}' | base64 -d ${append} /tmp/node_modules.tar.gz 2>/dev/null`, 30);
      if ((i + 1) % 50 === 0 || i === chunks - 1) {
        process.stdout.write(`\r[E2B] Uploaded ${i + 1}/${chunks} chunks (${totalMB}MB)...    `);
      }
    }
    console.log('');

    // Step 7: Extract on panel
    console.log('[E2B] Extracting node_modules on panel...');
    const extractResult = runOnPanel(
      `cd ${volumePath} && rm -rf node_modules && tar xzf /tmp/node_modules.tar.gz && ` +
      `ls node_modules 2>/dev/null | wc -l && du -sh node_modules 2>/dev/null && ` +
      `rm -f /tmp/node_modules.tar.gz`,
      60
    );
    console.log('[E2B] Extract result:', extractResult);

    console.log(`[E2B] ✓ npm install complete for ${volumeUuid}`);
    return { success: true, packages: parseInt(extractResult) || 0 };
  } catch (e) {
    console.error(`[E2B] ✗ Failed: ${e.message}`);
    return { success: false, error: e.message };
  }
}

/**
 * Cache a node_modules tarball on E2B under a key (e.g. "baileys-6.7").
 * Future installs with the same key can just download the cache.
 */
async function cacheNodeModules(cacheKey, localDir) {
  console.log(`[E2B] Caching ${localDir} as "${cacheKey}"...`);
  const sbx = await getSandbox();

  // Read the local dir, tar it, upload to E2B
  const tarResult = runOnPanel(`cd ${localDir} && tar czf /tmp/cache.tar.gz node_modules 2>/dev/null && ls -lh /tmp/cache.tar.gz`, 60);
  if (!tarResult.includes('cache.tar.gz')) {
    return { success: false, error: 'No node_modules to cache' };
  }

  // Read tarball from panel
  const b64 = runOnPanel(`base64 -w0 /tmp/cache.tar.gz`, 60);
  if (!b64) return { success: false, error: 'Failed to read tarball' };

  // Upload to E2B
  const buffer = Buffer.from(b64, 'base64');
  await sbx.files.write(`/tmp/cache-${cacheKey}.tar.gz`, buffer);

  // Save cache index
  await sbx.files.write('/tmp/cache-index.txt', `${cacheKey}\n`, { append: true });
  runOnPanel('rm -f /tmp/cache.tar.gz', 5);

  console.log(`[E2B] ✓ Cached "${cacheKey}" (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
  return { success: true, size: buffer.length };
}

/**
 * Restore a cached node_modules tarball from E2B.
 */
async function getCachedNodeModules(cacheKey, volumeUuid) {
  console.log(`[E2B] Restoring cache "${cacheKey}" to ${volumeUuid}...`);
  const sbx = await getSandbox();
  const volumePath = `/var/lib/pterodactyl/volumes/${volumeUuid}`;

  try {
    // Check if cache exists on E2B
    const check = await sbx.commands.run(`test -f /tmp/cache-${cacheKey}.tar.gz && echo EXISTS || echo MISSING`);
    if (check.stdout.trim() !== 'EXISTS') {
      return { success: false, error: 'Cache not found' };
    }

    // Download from E2B
    const buffer = await sbx.files.read(`/tmp/cache-${cacheKey}.tar.gz`, 'bytes');
    const b64 = Buffer.from(buffer).toString('base64');

    // Upload to panel (small chunks to avoid E2BIG)
    const chunkSize = 500000; // 50KB chunks
    const chunks = Math.ceil(b64.length / chunkSize);
    runOnPanel(`rm -f /tmp/restore.tar.gz`, 5);
    for (let i = 0; i < chunks; i++) {
      const chunk = b64.slice(i * chunkSize, (i + 1) * chunkSize);
      const append = i > 0 ? '>>' : '>';
      runOnPanel(`echo '${chunk}' | base64 -d ${append} /tmp/restore.tar.gz 2>/dev/null`, 30);
    }

    // Extract
    const extract = runOnPanel(
      `cd ${volumePath} && rm -rf node_modules && tar xzf /tmp/restore.tar.gz && ` +
      `ls node_modules 2>/dev/null | wc -l && rm -f /tmp/restore.tar.gz`,
      60
    );

    console.log(`[E2B] ✓ Restored cache "${cacheKey}" (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
    return { success: true, packages: parseInt(extract) || 0 };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Auto-install node_modules for ALL servers that have a package.json but no node_modules.
 * Uses E2B for the heavy lifting. Also caches common dependency sets.
 */
async function autoInstallAll() {
  console.log('[E2B] Auto-installing node_modules for all servers...');

  // Get all volume UUIDs with package.json
  const volumes = runOnPanel(
    `for d in /var/lib/pterodactyl/volumes/*/; do ` +
    `if [ -f "$d/package.json" ]; then ` +
    `basename "$d"; ` +
    `fi; ` +
    `done`,
    15
  ).trim().split('\n').filter(Boolean);

  console.log(`[E2B] Found ${volumes.length} servers with package.json`);

  let installed = 0;
  let skipped = 0;
  let failed = 0;

  for (const uuid of volumes) {
    // Check if node_modules already exists and is non-empty
    const hasModules = runOnPanel(
      `test -d /var/lib/pterodactyl/volumes/${uuid}/node_modules && ` +
      `[ "$(ls -A /var/lib/pterodactyl/volumes/${uuid}/node_modules 2>/dev/null | head -1)" ] && echo YES || echo NO`,
      10
    ).trim();

    if (hasModules === 'YES') {
      console.log(`[E2B] ✓ ${uuid}: node_modules already present, skipping`);
      skipped++;
      continue;
    }

    console.log(`[E2B] → Installing for ${uuid}...`);
    const result = await npmInstallOnE2B(uuid);
    if (result.success) {
      installed++;
    } else {
      failed++;
      console.error(`[E2B] ✗ Failed for ${uuid}: ${result.error}`);
    }
  }

  console.log(`\n[E2B] Summary: ${installed} installed, ${skipped} skipped, ${failed} failed`);
  return { installed, skipped, failed, total: volumes.length };
}

// === CLI ===
const command = process.argv[2];
const arg1 = process.argv[3];
const arg2 = process.argv[4];

(async () => {
  try {
    switch (command) {
      case 'install':
        if (!arg1) { console.error('Usage: install <volume_uuid> [packages]'); process.exit(1); }
        const r = await npmInstallOnE2B(arg1, arg2 || '');
        console.log(JSON.stringify(r));
        break;

      case 'cache-put':
        if (!arg1 || !arg2) { console.error('Usage: cache-put <cache_key> <local_dir>'); process.exit(1); }
        console.log(JSON.stringify(await cacheNodeModules(arg1, arg2)));
        break;

      case 'cache-get':
        if (!arg1 || !arg2) { console.error('Usage: cache-get <cache_key> <volume_uuid>'); process.exit(1); }
        console.log(JSON.stringify(await getCachedNodeModules(arg1, arg2)));
        break;

      case 'auto-install':
        console.log(JSON.stringify(await autoInstallAll()));
        break;

      case 'test':
        console.log('[E2B] Testing connection...');
        const sbx = await getSandbox();
        const info = await sbx.commands.run('echo "E2B OK" && df -h / && node --version && npm --version');
        console.log(info.stdout);
        break;

      default:
        console.log(`Death Legion E2B Storage Extension

Commands:
  install <volume_uuid> [packages]   Run npm install on E2B, sync node_modules to panel
  cache-put <key> <local_dir>        Cache a node_modules dir on E2B
  cache-get <key> <volume_uuid>      Restore cached node_modules to a server volume
  auto-install                       Auto-install node_modules for ALL servers missing them
  test                               Test E2B connection

Environment:
  E2B_API_KEY     ${E2B_API_KEY ? 'set' : 'NOT SET'}
  DAYTONA_TOKEN   ${DAYTONA_TOKEN ? 'set' : 'NOT SET'}`);
    }
  } catch (e) {
    console.error('Fatal error:', e.message);
    process.exit(1);
  }
})();
