/**
 * POST /api/widget/chat
 * Public (no auth) SSE chat endpoint for embedded widgets.
 * Body: { agentId, message, sessionId? }
 *
 * Proxies to Powabase's streaming endpoint and forwards SSE to the caller.
 * CORS headers allow any origin so external sites can embed the widget.
 */
import { NextRequest } from "next/server";
import { POWABASE_URL, powabaseHeaders } from "@/lib/powabase-server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
  const { agentId, message, sessionId } = await req.json();

  if (!agentId || !message) {
    return new Response(JSON.stringify({ error: "agentId and message required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  const body: Record<string, string> = { message };
  if (sessionId) body.session_id = sessionId;

  const upstream = await fetch(`${POWABASE_URL}/api/agents/${agentId}/run/stream`, {
    method: "POST",
    headers: powabaseHeaders(),
    body: JSON.stringify(body),
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: `Powabase error: ${upstream.status}` }), {
      status: 502,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      ...CORS,
    },
  });
}
