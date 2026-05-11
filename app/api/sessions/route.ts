/**
 * GET /api/sessions?agentId=xxx  → list sessions for an agent
 * DELETE /api/sessions?sessionId=yyy → delete a session
 */
import { NextRequest, NextResponse } from "next/server";
import { pbGet, pbDelete } from "@/lib/powabase-server";

export async function GET(req: NextRequest) {
  try {
    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });

    const data = await pbGet(`/api/agents/${agentId}/sessions`);
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    await pbDelete(`/api/sessions/${sessionId}`);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
