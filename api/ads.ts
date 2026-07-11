import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Ads API
 * =======
 * GET  /api/ads?action=info&user=<username>
 *      → Returns ad metadata + user's ad watch count for today
 *
 * POST /api/ads
 *      { user: "<username>", action: "watch", adId: "<id>" }
 *      → Grants 50 credits to user after "watching" an ad
 *      → Rate limited: max 10 ads/day per user (500 credits/day from ads)
 *
 * Ads are served from Google AdSense (or any ad network).
 * The "watch" action is triggered after the user views the ad for 15 seconds.
 */

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '16551277-c744-47d8-bbf4-f681442b1691';
const DAYTONA_API = 'https://app.daytona.io/api';

const AD_REWARD = 50;           // credits per ad
const MAX_ADS_PER_DAY = 10;     // rate limit
const AD_DURATION_SEC = 15;     // minimum watch time

// Ad catalog — real ad networks would go here
const AD_CATALOG = [
  { id: 'gaming-1',  title: 'Raid: Shadow Legends',   url: 'https://plarium.com/raid-shadow-legends',  category: 'gaming',  duration: 15 },
  { id: 'gaming-2',  title: 'World of Tanks',          url: 'https://worldoftanks.com',                 category: 'gaming',  duration: 15 },
  { id: 'tech-1',    title: 'Vercel — Deploy in 3 min', url: 'https://vercel.com',                      category: 'tech',    duration: 15 },
  { id: 'tech-2',    title: 'JetBrains — Try IDE',     url: 'https://jetbrains.com',                    category: 'tech',    duration: 15 },
  { id: 'vps-1',     title: 'Hetzner Cloud — €20 free', url: 'https://hetzner.com/cloud',              category: 'hosting', duration: 15 },
  { id: 'vps-2',     title: 'DigitalOcean — $200 credit', url: 'https://digitalocean.com',            category: 'hosting', duration: 15 },
  { id: 'crypto-1',  title: 'Binance — Start trading',  url: 'https://binance.com',                     category: 'crypto',  duration: 15 },
  { id: 'edu-1',     title: 'Coursera Plus',            url: 'https://coursera.org/plus',               category: 'education', duration: 15 },
  { id: 'music-1',   title: 'Spotify Premium — 3 months free', url: 'https://spotify.com/premium',     category: 'music',   duration: 15 },
  { id: 'game-3',    title: 'Steam — Summer Sale',     url: 'https://store.steampowered.com',           category: 'gaming',  duration: 15 },
];

// In-memory ad watch tracker (reset daily)
const adWatchLog: Record<string, { count: number; date: string; watched: string[] }> = {};

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function ensureAdLog(username: string) {
  const today = getTodayKey();
  if (!adWatchLog[username] || adWatchLog[username].date !== today) {
    adWatchLog[username] = { count: 0, date: today, watched: [] };
  }
}

async function addCreditsToUser(username: string, amount: number): Promise<{ success: boolean; credits?: any; error?: string }> {
  // Call the credits API to add credits
  try {
    const resp = await fetch(`https://deathlegionpanel.vercel.app/api/credits?action=add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: username, amount, targetUser: username }),
    });
    if (!resp.ok) return { success: false, error: `Credits API ${resp.status}` };
    const data = await resp.json();
    return { success: true, credits: data.credits };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const action = (req.query.action as string) || (req.body?.action as string);
  const username = (req.query.user as string) || (req.body?.user as string) || 'guest';

  // === GET: return ad info ===
  if (req.method === 'GET' || action === 'info') {
    ensureAdLog(username);
    const log = adWatchLog[username];
    return res.status(200).json({
      username,
      reward: AD_REWARD,
      maxAdsPerDay: MAX_ADS_PER_DAY,
      adsWatchedToday: log.count,
      adsRemaining: MAX_ADS_PER_DAY - log.count,
      adDuration: AD_DURATION_SEC,
      ads: AD_CATALOG,
    });
  }

  // === POST: watch ad (grant credits) ===
  if (req.method === 'POST' && action === 'watch') {
    const { adId } = req.body || {};
    ensureAdLog(username);
    const log = adWatchLog[username];

    // Rate limit check
    if (log.count >= MAX_ADS_PER_DAY) {
      return res.status(429).json({
        success: false,
        error: 'Daily ad limit reached',
        adsWatchedToday: log.count,
        maxAdsPerDay: MAX_ADS_PER_DAY,
        message: `You've watched the maximum ${MAX_ADS_PER_DAY} ads today. Credits reset at midnight UTC.`,
      });
    }

    // Find the ad
    const ad = AD_CATALOG.find(a => a.id === adId);
    if (!ad) {
      return res.status(404).json({ success: false, error: 'Ad not found' });
    }

    // Prevent watching the same ad twice in one day
    if (log.watched.includes(adId)) {
      return res.status(400).json({
        success: false,
        error: 'Already watched',
        message: 'You already watched this ad today. Try a different one.',
      });
    }

    // Grant credits
    const grantResult = await addCreditsToUser(username, AD_REWARD);
    if (!grantResult.success) {
      return res.status(500).json({ success: false, error: `Failed to grant credits: ${grantResult.error}` });
    }

    // Update log
    log.count += 1;
    log.watched.push(adId);

    return res.status(200).json({
      success: true,
      adId: ad.id,
      adTitle: ad.title,
      reward: AD_REWARD,
      newBalance: grantResult.credits,
      adsWatchedToday: log.count,
      adsRemaining: MAX_ADS_PER_DAY - log.count,
      message: `Ad watched! +${AD_REWARD} credits added to your account.`,
    });
  }

  // === POST: random ad (pick one the user hasn't watched today) ===
  if (req.method === 'POST' && action === 'random') {
    ensureAdLog(username);
    const log = adWatchLog[username];
    const available = AD_CATALOG.filter(a => !log.watched.includes(a.id));
    if (available.length === 0) {
      return res.status(429).json({
        success: false,
        error: 'No more ads available today',
        adsWatchedToday: log.count,
      });
    }
    const randomAd = available[Math.floor(Math.random() * available.length)];
    return res.status(200).json({ success: true, ad: randomAd });
  }

  return res.status(400).json({ error: 'Unknown action. Use action=info, action=watch, or action=random.' });
}

export const config = { api: { bodyParser: true }, maxDuration: 30 };
