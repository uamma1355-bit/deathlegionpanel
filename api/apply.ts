import type { VercelRequest, VercelResponse } from '@vercel/node';

const DAYTONA_TOKEN = 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
const SANDBOX_ID = '210e4afe-d6d5-4cc1-b3d3-05f40077ea15';
const DAYTONA_API = 'https://app.daytona.io/api';

async function executeOnSandbox(command: string, timeout: number = 30): Promise<string> {
  const url = `${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${DAYTONA_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ command, cwd: '/home/daytona', timeout }),
  });
  const data = await resp.json() as any;
  return data.result || '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const { first_name, last_name, username, email, password } = body;

    if (!first_name || !last_name || !username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (password.length < 8) return res.status(400).json({ error: 'Password must be 8+ characters' });

    // Save application to database (status=pending) via MySQL
    const escapedUser = username.replace(/'/g, "\\'");
    const escapedEmail = email.replace(/'/g, "\\'");
    const escapedPass = password.replace(/'/g, "\\'");
    const escapedFirst = first_name.replace(/'/g, "\\'");
    const escapedLast = last_name.replace(/'/g, "\\'");

    const result = await executeOnSandbox(
      `mysql -u pterodactyl -pptero_app_pw_2025 pterodactyl -e "INSERT INTO applications (first_name, last_name, username, email, password, status) VALUES ('${escapedFirst}', '${escapedLast}', '${escapedUser}', '${escapedEmail}', '${escapedPass}', 'pending')" 2>&1; echo INSERT_DONE`,
      15
    );

    if (result.includes('Duplicate')) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    if (!result.includes('INSERT_DONE')) {
      return res.status(500).json({ error: 'Failed to submit application', detail: result });
    }

    return res.status(200).json({
      success: true,
      message: 'Application submitted! An admin will review your request.',
      status: 'pending',
      username,
    });
  } catch (err) {
    console.error('Apply error:', err);
    return res.status(500).json({ error: 'Failed', detail: err instanceof Error ? err.message : String(err) });
  }
}

export const config = {
  api: { bodyParser: true, sizeLimit: '10mb' },
  maxDuration: 60,
};
