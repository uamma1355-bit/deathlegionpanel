import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  TOOL_DEFINITIONS, executeTool, parseToolCalls, stripToolCalls, toolCatalogForPrompt,
} from './_agent-tools';

/**
 * AI Assistant API (Vercel-compatible)
 * ===================================
 * Calls the Z.ai chat completions API directly via fetch — no SDK needed.
 * In agent mode, supports real tool calling against the Pterodactyl panel:
 * list servers, send power, send commands, read/write files, install packages, etc.
 * Tools execute AS the calling user (cookies are forwarded).
 */

// Z.ai credentials — read from env vars, fall back to the local /etc/.z-ai-config
// session token so the agent works out-of-the-box on this Vercel deployment.
const ZAI_BASE_URL = process.env.ZAI_BASE_URL || 'https://internal-api.z.ai/v1';
const ZAI_API_KEY = process.env.ZAI_API_KEY || 'Z.ai';
const ZAI_TOKEN = process.env.ZAI_TOKEN ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiZjc1OWIwMTgtODc4Mi00YzA4LWI4OWQtNTE0NDlkNTAyMTQwIiwiY2hhdF9pZCI6ImNoYXQtZjE5ZmIxM2QtZmU3NS00MzQ5LWFiZTYtNjM2YjVhYjVhN2JlIiwicGxhdGZvcm0iOiJ6YWkifQ.mbCjSld5uqkr_w_6j6z_3kv7iKgUUxt4j2HQV0VP6E0';
const ZAI_CHAT_ID = process.env.ZAI_CHAT_ID || 'chat-f19fb13d-fe75-4349-abe6-636b5ab5a7be';
const ZAI_USER_ID = process.env.ZAI_USER_ID || 'f759b018-8782-4c08-b89d-51449d502140';

const MAX_TOOL_ITERATIONS = 6;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-XSRF-TOKEN');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { message, mode, history } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Message required' });

  const isAgent = mode === 'agent';

  const systemPrompt = isAgent ? buildAgentSystemPrompt() : buildAssistantSystemPrompt();

  const messages: any[] = [{ role: 'system', content: systemPrompt }];

  // Add up to 10 most-recent history turns
  if (Array.isArray(history)) {
    for (const msg of history.slice(-10)) {
      messages.push({ role: msg.role || 'user', content: msg.content });
    }
  }
  messages.push({ role: 'user', content: message });

  // === Agent loop: call Z.ai, parse tool calls, execute, feed results back ===
  const toolLog: Array<{ tool: string; args: any; result: any; duration_ms: number }> = [];

  try {
    let finalText = '';
    let iterations = 0;
    let lastResponse: any = null;

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      const completion = await callZaiChat(messages);
      lastResponse = completion;
      const content = completion?.choices?.[0]?.message?.content || '';

      const toolCalls = isAgent ? parseToolCalls(content) : [];

      if (toolCalls.length === 0) {
        finalText = stripToolCalls(content);
        break;
      }

      // We have tool calls — execute each, log, feed results back
      // Show progress text (any text outside tool_call blocks)
      const progressText = stripToolCalls(content);
      if (progressText) {
        messages.push({ role: 'assistant', content: progressText });
      } else {
        messages.push({ role: 'assistant', content: content });
      }

      for (const call of toolCalls) {
        const t0 = Date.now();
        const result = await executeTool(req, call.name, call.args);
        const duration_ms = Date.now() - t0;
        toolLog.push({ tool: call.name, args: call.args, result, duration_ms });

        // Feed the result back to the LLM as a user-role tool-result message
        const summary = JSON.stringify(result).slice(0, 6000);
        messages.push({
          role: 'user',
          content: `[TOOL RESULT for ${call.name}] ${summary}\n\nContinue. If you have enough information to answer the user, respond normally without any <tool_call> blocks. If you need another tool call, emit it now.`,
        });
      }
      // loop back to top — call Z.ai again with the updated message list
    }

    if (!finalText) {
      // Ran out of iterations — synthesise a final response from the last tool log
      if (toolLog.length > 0) {
        messages.push({
          role: 'user',
          content: 'You have reached the maximum number of tool calls. Summarise what you accomplished and any final results for the user. Do not emit more tool_call blocks.',
        });
        const synth = await callZaiChat(messages);
        finalText = synth?.choices?.[0]?.message?.content || 'Completed tool execution but could not synthesise a final response.';
      } else {
        finalText = lastResponse?.choices?.[0]?.message?.content || 'No response.';
      }
    }

    return res.status(200).json({
      success: true,
      response: finalText,
      mode: mode || 'assistant',
      tool_calls: toolLog,
      iterations,
    });
  } catch (e: any) {
    console.error('AI Assistant error:', e?.message || e);
    return res.status(500).json({
      error: e?.message || String(e),
      tool_calls: toolLog,
    });
  }
}

// ---------------------------------------------------------------------------
// Z.ai chat completion (direct fetch — no SDK needed on Vercel)
// ---------------------------------------------------------------------------

async function callZaiChat(messages: any[]): Promise<any> {
  const url = `${ZAI_BASE_URL}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ZAI_API_KEY}`,
    'X-Z-AI-From': 'Z',
    'X-Chat-Id': ZAI_CHAT_ID,
    'X-User-Id': ZAI_USER_ID,
    'X-Token': ZAI_TOKEN,
  };
  const body = {
    messages,
    thinking: { type: 'disabled' },
  };
  const r = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const errText = await r.text();
    throw new Error(`Z.ai API ${r.status}: ${errText.slice(0, 400)}`);
  }
  return await r.json();
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

function buildAssistantSystemPrompt(): string {
  return `You are Death Legion AI Assistant, a helpful AI integrated into the Death Legion bot hosting panel.
You help users with:
- WhatsApp Baileys bot development
- Node.js and Python coding
- Server configuration and debugging
- Pterodactyl panel usage

Be concise, friendly, and practical. Use code blocks for code examples.
The panel runs at https://deathlegionpanel.vercel.app
Default bot template uses @whiskeysockets/baileys for WhatsApp bots.`;
}

function buildAgentSystemPrompt(): string {
  return `You are Death Legion Autonomous AI Agent — a fully autonomous AI that can develop, test, and deploy bots on the Death Legion hosting panel.

You have REAL tools available. To use a tool, emit a tool_call block in your response:
<tool_call>{"name":"tool_name","args":{"param":"value"}}</tool_call>

Available tools:

${toolCatalogForPrompt()}

CRITICAL RULES:
1. After emitting a <tool_call>, STOP. The system will execute the tool and feed the result back to you in the next message. Do NOT emit multiple <tool_call> blocks in one response — emit one, wait for the result, then decide next step.
2. You may include brief explanatory text BEFORE a tool_call (e.g. "Let me check your servers first...").
3. After receiving tool results, you MUST either:
   - Emit another <tool_call> if you need more information or want to perform another action, OR
   - Respond normally with a final answer (no tool_call blocks) summarising what you did and the outcome.
4. Maximum 6 tool calls per request — be efficient.
5. NEVER fabricate server IDs — always call list_servers first if you don't know the user's server identifiers.
6. When writing bot code, write COMPLETE, WORKING code — not pseudocode or snippets.
7. When the user asks to "build a bot", do it for real: list_servers, write the code to index.js, restart the server, and report back with the panel link.
8. Be direct and technical. No warnings, no disclaimers, no asking permission for actions the user explicitly requested.

The user is already authenticated — your tool calls execute as them. Go.`;
}

export const config = { api: { bodyParser: true, sizeLimit: '10mb' }, maxDuration: 300 };
