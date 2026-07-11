/**
 * OAuth Storage Module
 * ====================
 * Stores OAuth apps, authorization codes, access tokens, and refresh tokens
 * in the Pterodactyl MySQL database via the Daytona toolbox API.
 *
 * Tables (auto-created on first use):
 * - dl_oauth_apps: registered OAuth applications
 * - dl_oauth_codes: short-lived authorization codes (10 min, single use)
 * - dl_oauth_tokens: access + refresh tokens
 */

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
const SANDBOX_ID = process.env.DAYTONA_SANDBOX_ID || '16551277-c744-47d8-bbf4-f681442b1691';
const DAYTONA_API = 'https://app.daytona.io/api';
const DB_USER = 'pterodactyl';
const DB_PASS = 'ptero_app_pw_2025';
const DB_NAME = 'pterodactyl';

let tablesInitialized = false;

/** Escape a string for use in SQL single-quoted values (standard SQL: ' → '') */
function sqlEscape(s: string): string {
  return String(s ?? '').replace(/'/g, "''");
}

/** Execute a MySQL query on the panel sandbox */
async function mysqlQuery(sql: string, timeout = 15): Promise<string> {
  // Collapse to single line, escape for double-quoted shell string
  const singleLine = sql.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const escapedSql = singleLine.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const cmd = `mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} -e "${escapedSql}" 2>&1`;
  const body = JSON.stringify({ command: cmd, cwd: '/home/daytona', timeout });
  try {
    const resp = await fetch(`${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}`, 'Content-Type': 'application/json' },
      body,
    });
    const data = await resp.json() as any;
    return data.result || '';
  } catch (e: any) {
    throw new Error(`MySQL query failed: ${e?.message || e}`);
  }
}

/** Execute a MySQL query that returns rows as array of objects */
async function mysqlQueryJson(sql: string, timeout = 15): Promise<any[]> {
  const singleLine = sql.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
  const escapedSql = singleLine.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '\\$');
  const cmd = `mysql -u ${DB_USER} -p${DB_PASS} ${DB_NAME} -e "${escapedSql}" --batch --raw 2>&1`;
  const body = JSON.stringify({ command: cmd, cwd: '/home/daytona', timeout });
  try {
    const resp = await fetch(`${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}`, 'Content-Type': 'application/json' },
      body,
    });
    const data = await resp.json() as any;
    const result = data.result || '';
    return parseMysqlBatch(result);
  } catch (e: any) {
    throw new Error(`MySQL query failed: ${e?.message || e}`);
  }
}

/** Parse MySQL --batch --raw output into array of objects */
function parseMysqlBatch(output: string): any[] {
  const lines = output.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const values = line.split('\t');
    const obj: any = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] === 'NULL' ? null : values[i];
    });
    return obj;
  });
}

/** Initialize OAuth tables */
export async function initTables(): Promise<void> {
  if (tablesInitialized) return;
  await mysqlQuery(`
    CREATE TABLE IF NOT EXISTS dl_oauth_apps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      client_id VARCHAR(64) UNIQUE NOT NULL,
      client_secret VARCHAR(128) NOT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      homepage_url VARCHAR(500),
      logo_url VARCHAR(500),
      redirect_uris TEXT NOT NULL,
      active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await mysqlQuery(`
    CREATE TABLE IF NOT EXISTS dl_oauth_codes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(128) UNIQUE NOT NULL,
      client_id VARCHAR(64) NOT NULL,
      user_id INT NOT NULL,
      redirect_uri VARCHAR(500) NOT NULL,
      scope VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      used TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_code (code),
      INDEX idx_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await mysqlQuery(`
    CREATE TABLE IF NOT EXISTS dl_oauth_tokens (
      id INT AUTO_INCREMENT PRIMARY KEY,
      access_token VARCHAR(128) UNIQUE NOT NULL,
      refresh_token VARCHAR(128) UNIQUE NOT NULL,
      client_id VARCHAR(64) NOT NULL,
      user_id INT NOT NULL,
      scope VARCHAR(255) NOT NULL,
      access_expires_at TIMESTAMP NOT NULL,
      refresh_expires_at TIMESTAMP NULL,
      revoked TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_access (access_token),
      INDEX idx_refresh (refresh_token),
      INDEX idx_user (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  tablesInitialized = true;
}

/** Generate a random hex token */
export function generateToken(bytes: number = 32): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < bytes * 2; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

// === OAuth Apps ===

export interface OAuthApp {
  id: number;
  client_id: string;
  client_secret: string;
  name: string;
  description: string;
  homepage_url: string;
  logo_url: string | null;
  redirect_uris: string[];
  active: number;
  created_at: string;
  updated_at: string;
}

export async function createApp(data: {
  name: string; description?: string; homepageUrl?: string; logoUrl?: string; redirectUris: string[];
}): Promise<OAuthApp> {
  await initTables();
  const clientId = generateToken(16);
  const clientSecret = generateToken(32);
  const redirectUrisJson = JSON.stringify(data.redirectUris);
  await mysqlQuery(`
    INSERT INTO dl_oauth_apps (client_id, client_secret, name, description, homepage_url, logo_url, redirect_uris)
    VALUES ('${clientId}', '${clientSecret}', '${sqlEscape(data.name)}', '${sqlEscape(data.description || '')}', '${sqlEscape(data.homepageUrl || '')}', '${sqlEscape(data.logoUrl || '')}', '${sqlEscape(redirectUrisJson)}')
  `);
  const apps = await mysqlQueryJson(`SELECT * FROM dl_oauth_apps WHERE client_id='${clientId}'`);
  return apps[0] ? parseApp(apps[0]) : null!;
}

export async function getAppByClientId(clientId: string): Promise<OAuthApp | null> {
  await initTables();
  const apps = await mysqlQueryJson(`SELECT * FROM dl_oauth_apps WHERE client_id='${clientId}' AND active=1 LIMIT 1`);
  return apps[0] ? parseApp(apps[0]) : null;
}

export async function getAppById(id: number): Promise<OAuthApp | null> {
  await initTables();
  const apps = await mysqlQueryJson(`SELECT * FROM dl_oauth_apps WHERE id=${id} LIMIT 1`);
  return apps[0] ? parseApp(apps[0]) : null;
}

export async function listApps(): Promise<OAuthApp[]> {
  await initTables();
  const apps = await mysqlQueryJson(`SELECT * FROM dl_oauth_apps ORDER BY created_at DESC`);
  return apps.map(parseApp);
}

export async function updateApp(id: number, updates: {
  name?: string; description?: string; homepageUrl?: string; logoUrl?: string;
  redirectUris?: string[]; active?: boolean; rotateSecret?: boolean;
}): Promise<OAuthApp | null> {
  await initTables();
  const sets: string[] = [];
  if (updates.name !== undefined) sets.push(`name='${sqlEscape(updates.name)}'`);
  if (updates.description !== undefined) sets.push(`description='${sqlEscape(updates.description)}'`);
  if (updates.homepageUrl !== undefined) sets.push(`homepage_url='${sqlEscape(updates.homepageUrl)}'`);
  if (updates.logoUrl !== undefined) sets.push(`logo_url='${sqlEscape(updates.logoUrl)}'`);
  if (updates.redirectUris !== undefined) sets.push(`redirect_uris='${sqlEscape(JSON.stringify(updates.redirectUris))}'`);
  if (updates.active !== undefined) sets.push(`active=${updates.active ? 1 : 0}`);
  if (updates.rotateSecret) {
    const newSecret = generateToken(32);
    sets.push(`client_secret='${newSecret}'`);
  }
  if (sets.length === 0) return await getAppById(id);
  await mysqlQuery(`UPDATE dl_oauth_apps SET ${sets.join(', ')} WHERE id=${id}`);
  return await getAppById(id);
}

export async function deleteApp(id: number): Promise<void> {
  await initTables();
  await mysqlQuery(`DELETE FROM dl_oauth_apps WHERE id=${id}`);
  // Also revoke all tokens for this app
  await mysqlQuery(`UPDATE dl_oauth_tokens SET revoked=1 WHERE client_id=(SELECT client_id FROM dl_oauth_apps WHERE id=${id})`);
}

function parseApp(row: any): OAuthApp {
  return {
    ...row,
    redirect_uris: typeof row.redirect_uris === 'string' ? JSON.parse(row.redirect_uris) : [],
    active: parseInt(row.active),
  };
}

// === Authorization Codes ===

export interface AuthCode {
  code: string;
  client_id: string;
  user_id: number;
  redirect_uri: string;
  scope: string;
  expires_at: string;
  used: number;
}

export async function createAuthCode(data: {
  client_id: string; user_id: number; redirect_uri: string; scope: string;
}): Promise<string> {
  await initTables();
  const code = generateToken(32);
  await mysqlQuery(`
    INSERT INTO dl_oauth_codes (code, client_id, user_id, redirect_uri, scope, expires_at)
    VALUES ('${code}', '${sqlEscape(data.client_id)}', ${data.user_id}, '${sqlEscape(data.redirect_uri)}', '${sqlEscape(data.scope)}', DATE_ADD(NOW(), INTERVAL 10 MINUTE))
  `);
  return code;
}

export async function getAuthCode(code: string): Promise<AuthCode | null> {
  await initTables();
  const codes = await mysqlQueryJson(`SELECT * FROM dl_oauth_codes WHERE code='${code}' AND used=0 AND expires_at > NOW() LIMIT 1`);
  return codes[0] || null;
}

export async function markCodeUsed(code: string): Promise<void> {
  await initTables();
  await mysqlQuery(`UPDATE dl_oauth_codes SET used=1 WHERE code='${code}'`);
}

// === Tokens ===

export interface TokenRecord {
  access_token: string;
  refresh_token: string;
  client_id: string;
  user_id: number;
  scope: string;
  access_expires_at: string;
  refresh_expires_at: string | null;
  revoked: number;
}

export async function createTokens(data: {
  client_id: string; user_id: number; scope: string;
}): Promise<{ access_token: string; refresh_token: string; access_expires_at: string }> {
  await initTables();
  const accessToken = generateToken(32);
  const refreshToken = generateToken(32);
  // Access token: 1 hour. Refresh token: 90 days.
  await mysqlQuery(`
    INSERT INTO dl_oauth_tokens (access_token, refresh_token, client_id, user_id, scope, access_expires_at, refresh_expires_at)
    VALUES ('${accessToken}', '${refreshToken}', '${sqlEscape(data.client_id)}', ${data.user_id}, '${sqlEscape(data.scope)}', DATE_ADD(NOW(), INTERVAL 1 HOUR), DATE_ADD(NOW(), INTERVAL 90 DAY))
  `);
  return { access_token: accessToken, refresh_token: refreshToken, access_expires_at: new Date(Date.now() + 3600000).toISOString() };
}

export async function getAccessToken(token: string): Promise<TokenRecord | null> {
  await initTables();
  const tokens = await mysqlQueryJson(`SELECT * FROM dl_oauth_tokens WHERE access_token='${token}' AND revoked=0 AND access_expires_at > NOW() LIMIT 1`);
  return tokens[0] || null;
}

export async function getRefreshToken(token: string): Promise<TokenRecord | null> {
  await initTables();
  const tokens = await mysqlQueryJson(`SELECT * FROM dl_oauth_tokens WHERE refresh_token='${token}' AND revoked=0 LIMIT 1`);
  return tokens[0] || null;
}

export async function revokeToken(token: string): Promise<void> {
  await initTables();
  // Revoke by access OR refresh token
  await mysqlQuery(`UPDATE dl_oauth_tokens SET revoked=1 WHERE access_token='${token}' OR refresh_token='${token}'`);
}

export async function revokeOldRefreshAndCreateNew(oldRefresh: string, data: {
  client_id: string; user_id: number; scope: string;
}): Promise<{ access_token: string; refresh_token: string }> {
  await initTables();
  // Mark old refresh token's entire record as revoked
  await mysqlQuery(`UPDATE dl_oauth_tokens SET revoked=1 WHERE refresh_token='${oldRefresh}'`);
  // Create new token pair
  const result = await createTokens(data);
  return { access_token: result.access_token, refresh_token: result.refresh_token };
}

// === User info ===

export async function getUserById(userId: number): Promise<any> {
  const users = await mysqlQueryJson(`SELECT id, username, email, name_first, name_last, root_admin FROM users WHERE id=${userId} LIMIT 1`);
  return users[0] || null;
}

export async function getUserIdFromCookies(cookieHeader: string, xsrfToken: string): Promise<number | null> {
  // Call the panel API to get the current user
  try {
    const resp = await fetch('https://deathlegionpanel.vercel.app/api/client/account', {
      headers: {
        'Accept': 'application/json',
        'Cookie': cookieHeader,
        'X-XSRF-TOKEN': xsrfToken,
      },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    // We need the user ID — the account API doesn't return it directly, but we can look up by username
    const username = data?.attributes?.username;
    if (!username) return null;
    const users = await mysqlQueryJson(`SELECT id FROM users WHERE username='${username.replace(/'/g, "'\\''")}' LIMIT 1`);
    return users[0]?.id ? parseInt(users[0].id) : null;
  } catch {
    return null;
  }
}

/** Clean up expired codes and tokens (call periodically) */
export async function cleanup(): Promise<void> {
  await initTables();
  await mysqlQuery(`DELETE FROM dl_oauth_codes WHERE expires_at < NOW() OR used=1`);
  await mysqlQuery(`UPDATE dl_oauth_tokens SET revoked=1 WHERE access_expires_at < NOW() AND refresh_expires_at < NOW()`);
}
