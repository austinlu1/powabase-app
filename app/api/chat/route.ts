/**
 * POST /api/chat
 * Body: { agentId, message, sessionId? }
 *
 * Proxies to Powabase's SSE streaming endpoint and forwards the stream to the browser.
 * The service key never leaves the server — the browser only talks to /api/chat.
 *
 * Powabase streams SSE events:
 *   chunk           → token of the final LLM response
 *   step_started    → new ReAct iteration
 *   tool_call       → agent calling a tool
 *   tool_result     → tool result
 *   run_complete    → run finished (includes session_id if auto-created)
 */
import { NextRequest } from "next/server";
import { POWABASE_URL, powabaseHeaders } from "@/lib/powabase-server";

export async function POST(req: NextRequest) {
  const { agentId, message, sessionId } = await req.json();

  if (!agentId || !message) {
    return new Response(JSON.stringify({ error: "agentId and message required" }), { status: 400 });
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
