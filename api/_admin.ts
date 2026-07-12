/**
 * Shared Admin Auth + DB helpers
 * Used by all admin pages to verify the user is an authenticated admin.
 */

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
const SANDBOX_ID = '16551277-c744-47d8-bbf4-f681442b1691';
const DAYTONA_API = 'https://app.daytona.io/api';
const DB_USER = 'pterodactyl';
const DB_PASS = 'ptero_app_pw_2025';
const DB_NAME = 'pterodactyl';

/** Execute a MySQL query, returns rows as array of objects */
export async function mysqlQueryJson(sql: string, timeout = 15): Promise<any[]> {
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
    return parseMysqlBatch(data.result || '');
  } catch { return []; }
}

/** Execute a MySQL non-SELECT query */
export async function mysqlQuery(sql: string, timeout = 15): Promise<string> {
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
  } catch (e: any) { return `Error: ${e?.message || e}`; }
}

function parseMysqlBatch(output: string): any[] {
  const lines = output.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const values = line.split('\t');
    const obj: any = {};
    headers.forEach((h, i) => { obj[h] = values[i] === 'NULL' ? null : values[i]; });
    return obj;
  });
}

/** Escape a string for SQL single-quoted values */
export function sqlEscape(s: string): string {
  return String(s ?? '').replace(/'/g, "''");
}

/**
 * Verify the request is from an authenticated admin user.
 * Returns the user object if admin, or null if not authenticated/not admin.
 */
export async function verifyAdmin(req: any): Promise<any | null> {
  try {
    const cookieHeader = (req.headers['cookie'] as string) || '';
    const xsrfToken = (req.headers['x-xsrf-token'] as string) || '';
    if (!cookieHeader) return null;

    // Call the panel API to get the current user
    const resp = await fetch('https://deathlegionpanel.vercel.app/api/client/account', {
      headers: {
        'Accept': 'application/json',
        'Cookie': cookieHeader,
        'X-XSRF-TOKEN': xsrfToken,
      },
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const username = data?.attributes?.username;
    if (!username) return null;

    // Look up the user in DB to check admin
    const users = await mysqlQueryJson(`SELECT id, username, email, root_admin, name_first, name_last FROM users WHERE username='${sqlEscape(username)}' LIMIT 1`);
    if (!users[0] || users[0].root_admin != 1) return null;
    return users[0];
  } catch {
    return null;
  }
}

/** Log an admin action to the activity log */
export async function logAdminAction(adminId: number, action: string, details: string = ''): Promise<void> {
  try {
    await mysqlQuery(`INSERT INTO activity_logs (actor_id, event, description, properties, created_at) VALUES (${adminId}, 'admin_${sqlEscape(action)}', '${sqlEscape(details)}', '{}', NOW())`);
  } catch { /* non-critical */ }
}
