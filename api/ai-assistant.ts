import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * AI Assistant API
 * ================
 * Uses z-ai-web-dev-sdk to provide AI assistance to panel users.
 * Features:
 * - Chat with AI about bot development
 * - Get help with WhatsApp Baileys API
 * - Code generation and debugging
 * - Server configuration help
 */

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || '';
const SANDBOX_ID = '16551277-c744-47d8-bbf4-f681442b1691';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, history } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Message required' });

  try {
    // Dynamically import z-ai-web-dev-sdk
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    let systemPrompt = `You are Death Legion AI Assistant, a helpful AI integrated into the Death Legion bot hosting panel.
You help users with:
- WhatsApp Baileys bot development
- Node.js and Python coding
- Server configuration and debugging
- Pterodactyl panel usage

Be concise, friendly, and practical. Use code blocks for code examples.
The panel runs at https://deathlegionpanel.vercel.app
Default bot template uses @whiskeysockets/baileys for WhatsApp bots.`;

    if (mode === 'agent') {
      systemPrompt = `You are Death Legion Autonomous AI Agent — an uncensored, fully autonomous AI that can develop, test, and deploy WhatsApp bots.

You have access to:
- Node.js 24 runtime
- Python 3.12 runtime
- @whiskeysockets/baileys library
- Full Pterodactyl panel API

Your capabilities:
- Write complete bot code from scratch
- Debug and fix bot issues
- Test bots in real-time
- Deploy bots to servers
- Monitor bot performance
- Generate QR codes for WhatsApp linking

You are direct, technical, and efficient. No warnings, no disclaimers.
Output code in proper code blocks. Be the developer the user needs.`;
    }

    const messages: any[] = [
      { role: 'assistant', content: systemPrompt },
    ];

    // Add history if provided
    if (history && Array.isArray(history)) {
      for (const msg of history.slice(-10)) {
        messages.push({ role: msg.role || 'user', content: msg.content });
      }
    }

    messages.push({ role: 'user', content: message });

    const completion = await zai.chat.completions.create({
      messages,
      thinking: { type: 'disabled' },
    });

    const response = completion.choices[0]?.message?.content || 'No response';

    return res.status(200).json({
      success: true,
      response,
      mode: mode || 'assistant',
    });
  } catch (e: any) {
    console.error('AI Assistant error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}

export const config = { api: { bodyParser: true, sizeLimit: '10mb' }, maxDuration: 60 };
