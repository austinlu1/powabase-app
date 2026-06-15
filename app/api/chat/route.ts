/**
 * POST /api/chat
 * Body: { agentId, message, sessionId? }
 *
 * Proxies to Powabase's SSE streaming endpoint and forwards the stream to the browser.
 * The service key never leaves the server — the browser only talks to /api/chat.
 *
 * Powabase streams SSE events:
 *   start           → run started (includes session_id)
 *   content_delta   → streaming token (delta field)
 *   tool_call       → agent calling a tool
 *   tool_result     → tool result
 *   chunk           → full response content
 *   complete        → run finished
 */
import { NextRequest } from "next/server";
import { POWABASE_URL, powabaseHeaders, getUserFromCookie, listAgentsWithDescription, parseAgentName, pbGet } from "@/lib/powabase-server";

const SESSION_TOKEN_LIMIT = 50_000;

/** Rough token estimate: ~4 chars per token (standard heuristic) */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function POST(req: NextRequest) {
  const { user } = await getUserFromCookie(req);
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  }

  const { agentId, message, sessionId } = await req.json();

  if (!agentId || !message) {
    return new Response(JSON.stringify({ error: "agentId and message required" }), { status: 400 });
  }

  // Verify the agent belongs to this user
  const userAgents = await listAgentsWithDescription();
  const owned = userAgents.some(a => a.id === agentId && parseAgentName(a.name)?.uid === user.id);
  if (!owned) return new Response(JSON.stringify({ error: "Agent not found" }), { status: 404 });

  // Check session token limit against stored history
  if (sessionId) {
    try {
      const runsData = await pbGet(`/api/sessions/${sessionId}/runs`);
      const runs: { input_messages?: { content: string }[]; output_messages?: { content: string }[] }[] =
        runsData.runs ?? [];

      let historyTokens = 0;
      for (const run of runs) {
        for (const m of run.input_messages ?? []) historyTokens += estimateTokens(m.content ?? "");
        for (const m of run.output_messages ?? []) historyTokens += estimateTokens(m.content ?? "");
      }

      const incomingTokens = estimateTokens(message);
      if (historyTokens + incomingTokens > SESSION_TOKEN_LIMIT) {
        return new Response(
          JSON.stringify({
            error: "Session limit reached",
            message: `This conversation has reached the 50,000-token limit (~${Math.round(historyTokens / 1000)}k used). Please start a new chat to continue.`,
          }),
          { status: 429 }
        );
      }
    } catch {
      // If we can't fetch history, allow the request through rather than blocking
    }
  }

  const body: Record<string, string> = { message };
  if (sessionId) body.session_id = sessionId;

  // Open SSE stream to Powabase
  const upstream = await fetch(`${POWABASE_URL}/api/agents/${agentId}/run/stream`, {
    method: "POST",
    headers: powabaseHeaders(),
    body: JSON.stringify(body),
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: `Powabase error: ${upstream.status}` }), { status: 502 });
  }

  // Forward the SSE stream directly to the browser
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
