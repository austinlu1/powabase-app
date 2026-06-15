/**
 * GET /api/sessions?agentId=xxx  → list sessions for an agent
 * DELETE /api/sessions?sessionId=yyy&agentId=xxx → delete a session
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbGet, pbDelete, listAgentsWithDescription, parseAgentName } from "@/lib/powabase-server";

export async function GET(req: NextRequest) {
  try {
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

    // Verify the agent belongs to this user
    const userAgents = await listAgentsWithDescription();
    const owned = userAgents.some(a => a.id === agentId && parseAgentName(a.name)?.uid === user.id);
    if (!owned) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const data = await pbGet(`/api/agents/${agentId}/sessions`);
    return applyRefresh(NextResponse.json(data));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionId = req.nextUrl.searchParams.get("sessionId");
    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    // Verify agent ownership if agentId provided
    if (agentId) {
      const userAgents = await listAgentsWithDescription();
      const owned = userAgents.some(a => a.id === agentId && parseAgentName(a.name)?.uid === user.id);
      if (!owned) return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    await pbDelete(`/api/sessions/${sessionId}`);
    return applyRefresh(NextResponse.json({ success: true }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
