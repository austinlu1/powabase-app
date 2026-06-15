/**
 * GET /api/sources?agentId={id}
 * Returns sources for the authenticated user, filtered by agent KB.
 * Source name format: "{userId}:{kbId}:{uuid}:{filename}"
 * For sources shared across agents: "{userId}:{kbA}+{kbB}:{uuid}:{filename}"
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbGet, listAgentsWithDescription, parseAgentName } from "@/lib/powabase-server";

export async function GET(req: NextRequest) {
  try {
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const agentId = req.nextUrl.searchParams.get("agentId");

    const data = await pbGet("/api/sources");
    const allSources: { id: string; name?: string; extraction_status?: string; created_at?: string }[] = data.sources ?? [];

    if (!agentId) {
      const sources = allSources
        .filter((s) => s.name?.startsWith(`${user.id}:`))
        .map((s) => ({ ...s, name: s.name!.split(":").slice(3).join(":") }));
      return applyRefresh(NextResponse.json({ sources }));
    }

    // Look up the agent's kbId and verify ownership
    const agents = await listAgentsWithDescription();
    const agent = agents.find((a) => a.id === agentId);
    if (!agent) return applyRefresh(NextResponse.json({ sources: [] }));
    const meta = parseAgentName(agent.name);
    if (!meta || meta.uid !== user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    const kbId = meta.kid;
    const userSources = allSources.filter((s) => s.name?.startsWith(`${user.id}:`));

    // Filter: owned by this user AND kbId appears in the "+" separated kbIds field
    // Name format: "{userId}:{kbA}+{kbB}:{uuid}:{filename}"
    const sources = userSources
      .filter((s) => {
        const kbField = s.name!.split(":")[1] ?? "";
        return kbField.split("+").includes(kbId);
      })
      .map((s) => ({ ...s, name: s.name!.split(":").slice(3).join(":") }));

    return applyRefresh(NextResponse.json({ sources }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
