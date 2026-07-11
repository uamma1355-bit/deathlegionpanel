import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Credit System API
 * ================
 * - Regular users: 100 credits/day (resets at midnight UTC)
 * - DL ID members: 200 credits/day
 * - Admin: unlimited
 * - Credits are spent on: starting servers, using AI assistant, etc.
 */

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '16551277-c744-47d8-bbf4-f681442b1691';
const DAYTONA_API = 'https://app.daytona.io/api';

async function executeOnSandbox(command: string, timeout: number = 30): Promise<string> {
  const resp = await fetch(`${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${DAYTONA_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ command, cwd: '/home/daytona', timeout }),
  });
  return (await resp.json() as any).result || '';
}

// In-memory credit store (resets on function cold start, but that's OK for now)
// In production, this would use a database
const creditStore: Record<string, { credits: number; lastReset: string; totalUsed: number; plan: string }> = {};

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function getUserPlan(username: string): { plan: string; dailyLimit: number } {
  if (username === 'admin') return { plan: 'Admin', dailyLimit: -1 }; // unlimited
  // DL ID members (could check against a list)
  const dlMembers = ['tharu7862', 'zeus', 'zeusdl', 'zeusgd'];
  if (dlMembers.includes(username)) return { plan: 'DL Member', dailyLimit: 200 };
  return { plan: 'Free', dailyLimit: 100 };
}

function ensureUser(username: string) {
  const today = getTodayKey();
  if (!creditStore[username]) {
    const { plan, dailyLimit } = getUserPlan(username);
    creditStore[username] = {
      credits: dailyLimit === -1 ? 999999 : dailyLimit,
      lastReset: today,
      totalUsed: 0,
      plan,
    };
  }
  // Reset credits daily
  if (creditStore[username].lastReset !== today) {
    const { plan, dailyLimit } = getUserPlan(username);
    creditStore[username].credits = dailyLimit === -1 ? 999999 : dailyLimit;
    creditStore[username].lastReset = today;
    creditStore[username].plan = plan;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = req.query.action as string;
  const username = (req.query.user as string) || (req.body?.user as string) || 'guest';

  if (action === 'balance' || (req.method === 'GET' && !action)) {
    ensureUser(username);
    const user = creditStore[username];
    const { dailyLimit } = getUserPlan(username);
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const msUntilReset = tomorrow.getTime() - now.getTime();
    const hoursUntilReset = Math.floor(msUntilReset / (1000 * 60 * 60));
    const minsUntilReset = Math.floor((msUntilReset % (1000 * 60 * 60)) / (1000 * 60));

    return res.status(200).json({
      username,
      plan: user.plan,
      credits: user.plan === 'Admin' ? 'Unlimited' : user.credits,
      dailyLimit: user.plan === 'Admin' ? 'Unlimited' : dailyLimit,
      totalUsed: user.totalUsed,
      resetIn: `${hoursUntilReset}h ${minsUntilReset}m`,
      resetAt: tomorrow.toISOString(),
    });
  }

  if (action === 'spend' && req.method === 'POST') {
    const { amount } = req.body || {};
    const cost = parseInt(amount) || 1;
    ensureUser(username);
    const user = creditStore[username];

    if (user.plan !== 'Admin' && user.credits < cost) {
      return res.status(403).json({ error: 'Insufficient credits', credits: user.credits, needed: cost });
    }

    if (user.plan !== 'Admin') {
      user.credits -= cost;
    }
    user.totalUsed += cost;

    return res.status(200).json({
      success: true,
      credits: user.plan === 'Admin' ? 'Unlimited' : user.credits,
      spent: cost,
    });
  }

  if (action === 'add' && req.method === 'POST') {
    const { amount, targetUser } = req.body || {};
    const addUser = targetUser || username;
    const addAmount = parseInt(amount) || 0;
    ensureUser(addUser);
    creditStore[addUser].credits += addAmount;

    return res.status(200).json({
      success: true,
      username: addUser,
      credits: creditStore[addUser].plan === 'Admin' ? 'Unlimited' : creditStore[addUser].credits,
    });
  }

  if (action === 'plans') {
    return res.status(200).json({
      plans: [
        { name: 'Free', dailyCredits: 100, features: ['2 Node.js servers', '1 Python server', 'Basic AI assistant'] },
        { name: 'DL Member', dailyCredits: 200, features: ['2 Node.js servers', '1 Python server', 'AI assistant', 'Priority support'] },
        { name: 'Admin', dailyCredits: 'Unlimited', features: ['All servers', 'Full AI access', 'Autonomous AI agent', 'Admin panel'] },
      ],
    });
  }

  return res.status(400).json({ error: 'Unknown action' });
}

export const config = { api: { bodyParser: true }, maxDuration: 30 };
