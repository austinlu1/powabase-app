/**
 * GET  /api/session-sources?sessionId=xxx  → fetch all attachments for a session
 * POST /api/session-sources                → save an attachment to the DB
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbRestGet, pbRestPost } from "@/lib/powabase-server";

export async function GET(req: NextRequest) {
  try {
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const sessionId = req.nextUrl.searchParams.get("sessionId");
    if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

    const rows = await pbRestGet("session_sources", {
      session_id: `eq.${sessionId}`,
      user_id: `eq.${user.id}`,
      order: "created_at.asc",
    });

    return applyRefresh(NextResponse.json({ sources: rows }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { session_id, source_id, name, type, extracted_text } = await req.json();
    if (!session_id || !name || !type) {
      return NextResponse.json({ error: "session_id, name, type required" }, { status: 400 });
    }

    await pbRestPost("session_sources", {
      session_id,
      source_id: source_id ?? "",
      user_id: user.id,
      name,
      type,
      extracted_text: extracted_text ?? "",
    }, "return=representation");

    return applyRefresh(NextResponse.json({ success: true }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
