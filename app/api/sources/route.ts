/**
 * GET /api/sources?agentId={id}
 * Returns sources for the authenticated user, filtered by agent KB.
 * Source name format: "{userId}:{kbId}:{uuid}:{filename}"
 * For sources shared across agents/users: "{anyUserId}:{kbA}+{kbB}:{uuid}:{filename}"
 *
 * Ownership is determined by kbId membership (not userId prefix) so that cross-user
 * content-dedup'd sources still appear correctly for each user.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbGet, listAgentsWithDescription, parseAgentName } from "@/lib/powabase-server";

export async function GET(req: NextRequest) {
  try {
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const agentId = req.nextUrl.searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ sources: [] });

    // Verify the agent belongs to this user and get its kbId
    const agents = await listAgentsWithDescription();
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return applyRefresh(NextResponse.json({ sources: [] }));
    const meta = parseAgentName(agent.name);
    if (!meta || meta.uid !== user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    const kbId = meta.kid;

    const data = await pbGet("/api/sources");
    const allSources: { id: string; name?: string; extraction_status?: string; created_at?: string }[] = data.sources ?? [];

    // Filter: this user's kbId appears in position [1] of the name (supports "+" joined kbIds)
    const sources = allSources
      .filter((s) => {
        if (!s.name) return false;
        const parts = s.name.split(":");
        if (parts.length < 4) return false;
        return parts[1].split("+").includes(kbId);
      })
      .map((s) => {
        const parts = s.name!.split(":");
        // New format: {userId}:{kbId}:{uuid}:sz={bytes}:{filename}
        // Old format: {userId}:{kbId}:{uuid}:{filename}
        let file_size = 0;
        let displayName: string;
        if (parts[3]?.startsWith("sz=")) {
          file_size = parseInt(parts[3].slice(3), 10) || 0;
          displayName = parts.slice(4).join(":");
        } else {
          displayName = parts.slice(3).join(":");
        }
        return { ...s, name: displayName, file_size };
      });

    return applyRefresh(NextResponse.json({ sources }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
