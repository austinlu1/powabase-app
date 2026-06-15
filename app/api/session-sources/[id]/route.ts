/**
 * DELETE /api/session-sources/[id]
 * Removes a session attachment from the DB.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbRestDelete } from "@/lib/powabase-server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    await pbRestDelete("session_sources", {
      id: `eq.${id}`,
      user_id: `eq.${user.id}`,
    });

    return applyRefresh(NextResponse.json({ success: true }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
