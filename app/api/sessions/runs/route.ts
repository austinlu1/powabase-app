/**
 * GET /api/sessions/runs?sessionId=xxx → fetch all runs (message history) for a session
 */
import { NextRequest, NextResponse } from "next/server";
import { pbGet } from "@/lib/powabase-server";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const data = await pbGet(`/api/sessions/${sessionId}/runs`);
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
