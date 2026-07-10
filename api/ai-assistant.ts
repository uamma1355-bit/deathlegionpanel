import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  executeTool, parseToolCalls, stripToolCalls, toolCatalogForPrompt,
} from './_agent-tools';

/**
 * AI Assistant API (Vercel → Daytona sandbox → Z.ai internal API)
 * =================================================================
 * The Z.ai internal API (internal-api.z.ai) is only reachable from inside
 * Z.ai's infrastructure. Vercel functions run on Vercel's network, so they
 * cannot call it directly. Solution: delegate the LLM call to the Daytona
 * sandbox (which IS inside Z.ai's infra) via the toolbox execute API.
 *
 * Flow:
 *   1. Vercel function receives user message + cookies
 *   2. Builds messages array with system prompt + history
 *   3. Calls Daytona toolbox → runs Python script that uses z-ai-web-dev-sdk
 *   4. Gets LLM response back as JSON
 *   5. Parses <tool_call> blocks from response
 *   6. If tool calls: executes them directly (Vercel → Pterodactyl API with
 *      user's cookies), feeds results back as user messages, loops to step 3
 *   7. Returns final response + tool log to the UI
 */

const DAYTONA_TOKEN = process.env.DAYTONA_TOKEN || 'dtn_c7bdd782306f6072855d802d3324bd7cd9c90597d29224bf30447bbef5385b22';
const SANDBOX_ID = process.env.DAYTONA_SANDBOX_ID || '16551277-c744-47d8-bbf4-f681442b1691';
const DAYTONA_API = 'https://app.daytona.io/api';

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
  if (Array.isArray(history)) {
    for (const msg of history.slice(-10)) {
      messages.push({ role: msg.role || 'user', content: msg.content });
    }
  }
  messages.push({ role: 'user', content: message });

  const toolLog: Array<{ tool: string; args: any; result: any; duration_ms: number }> = [];

  try {
    let finalText = '';
    let iterations = 0;

    let completion: { ok: boolean; content?: string; error?: string } | null = null;
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      completion = await callZaiViaSandbox(messages);
      if (!completion.ok) {
        return res.status(500).json({
          error: `Z.ai call failed: ${completion.error}`,
          tool_calls: toolLog,
        });
      }
      const content = completion.content || '';

      const toolCalls = isAgent ? parseToolCalls(content) : [];

      if (toolCalls.length === 0) {
        finalText = stripToolCalls(content);
        break;
      }

      // Execute each tool call, log, feed result back
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

        const summary = JSON.stringify(result).slice(0, 6000);
        messages.push({
          role: 'user',
          content: `[TOOL RESULT for ${call.name}] ${summary}\n\nContinue. If you have enough information to answer the user, respond normally without any <tool_call> blocks. If you need another tool call, emit it now.`,
        });
      }
    }

    if (!finalText) {
      if (toolLog.length > 0) {
        messages.push({
          role: 'user',
          content: 'You have reached the maximum number of tool calls. Summarise what you accomplished and any final results for the user. Do not emit more tool_call blocks.',
        });
        const synth = await callZaiViaSandbox(messages);
        finalText = synth.ok ? (synth.content || 'Completed tool execution.') : 'Completed tool execution but could not synthesise a final response.';
      } else {
        finalText = completion?.content || 'No response.';
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
// Call Z.ai via the Daytona sandbox (which is inside Z.ai's infra)
// ---------------------------------------------------------------------------

async function callZaiViaSandbox(messages: any[]): Promise<{ ok: boolean; content?: string; error?: string }> {
  // Build a Python script that calls the Z.ai SDK and prints JSON to stdout
  const messagesJson = JSON.stringify(messages).replace(/'/g, "'\\''");
  const pyScript = `import json, sys
try:
    from z_ai_web_dev_sdk import ZAI
    zai = ZAI.create()
    completion = zai.chat.completions.create(
        messages=${messagesJson},
        thinking={"type": "disabled"}
    )
    content = completion.choices[0].message.content if completion.choices else ""
    print(json.dumps({"ok": True, "content": content}))
except Exception as e:
    print(json.dumps({"ok": False, "error": str(e)}))
`;

  const executeUrl = `${DAYTONA_API}/toolbox/${SANDBOX_ID}/toolbox/process/execute`;

  try {
    const response = await fetch(executeUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DAYTONA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: `python3 -c '${pyScript.replace(/'/g, "'\\''")}'`,
        cwd: '/home/daytona',
        timeout: 60,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `Daytona API ${response.status}: ${errText.slice(0, 200)}` };
    }

    const data = await response.json();
    const result: string = (data.result || '').trim();

    // The Python script prints JSON to stdout — parse the LAST line (in case there's stderr noise)
    const lines = result.split('\n').filter((l: string) => l.trim().startsWith('{'));
    const lastJson = lines[lines.length - 1] || result;

    try {
      const parsed = JSON.parse(lastJson);
      return parsed;
    } catch {
      return { ok: false, error: `Parse failed: ${result.slice(0, 300)}` };
    }
  } catch (e: any) {
    return { ok: false, error: `Network error: ${e?.message || String(e)}` };
  }
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
