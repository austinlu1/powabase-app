/**
 * DELETE /api/sources/[id]
 * Deletes a source from Powabase and removes it from user_sources table.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbDelete, pbRestDelete } from "@/lib/powabase-server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Delete from Powabase
    await pbDelete(`/api/sources/${id}`);

    // Remove from user_sources table
    await pbRestDelete("user_sources", {
      user_id: `eq.${user.id}`,
      source_id: `eq.${id}`,
    });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
