/**
 * GET /api/sources
 * Returns only the sources belonging to the authenticated user
 * by joining user_sources with Powabase source details.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbGet, pbRestGet } from "@/lib/powabase-server";

interface UserSourceRow {
  source_id: string;
  name: string;
  created_at: string;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get this user's source IDs from our table
    const rows = await pbRestGet<UserSourceRow>("user_sources", {
      user_id: `eq.${user.id}`,
      select: "source_id,name,created_at",
      order: "created_at.desc",
    });

    if (rows.length === 0) return NextResponse.json({ sources: [] });

    // Fetch full source details from Powabase for each source
    const sources = await Promise.all(
      rows.map(async (row) => {
        try {
          const source = await pbGet(`/api/sources/${row.source_id}`);
          return source;
        } catch {
          // Source may have been deleted directly in Powabase — return minimal info
          return { id: row.source_id, name: row.name, extraction_status: "unknown", created_at: row.created_at };
        }
      })
    );

    return NextResponse.json({ sources });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
