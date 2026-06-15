/**
 * DELETE /api/sources/[id]?agentId={agentId}
 * If the source is shared across multiple agents (kbIds joined by "+"):
 *   - Remove only this agent's kbId from the name (detach from this KB only)
 * If the source belongs only to this agent's KB:
 *   - Delete it entirely from Powabase
 * Ownership is verified by checking the "{userId}:" name prefix.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbGet, pbPatch, pbDelete, listAgentsWithDescription, parseAgentName } from "@/lib/powabase-server";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const agentId = req.nextUrl.searchParams.get("agentId");

    // Verify ownership before deleting
    const source = await pbGet(`/api/sources/${id}`);
    if (!source.name?.startsWith(`${user.id}:`)) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    // If agentId provided, resolve its kbId to do a targeted detach
    if (agentId) {
      const agents = await listAgentsWithDescription();
      const agent = agents.find((a) => a.id === agentId);
      const meta = agent ? parseAgentName(agent.name) : null;

      if (meta && meta.uid === user.id) {
        const kbId = meta.kid;
        const parts = (source.name as string).split(":");
        // parts: [userId, kbField, uuid, ...filename]
        if (parts.length >= 3) {
          const kbIds = parts[1].split("+");
          if (kbIds.length > 1 && kbIds.includes(kbId)) {
            // Source is shared — detach from this KB only using the proper endpoint
            // First find the indexed_source_id for this source within this KB
            const kbSources = await pbGet(`/api/knowledge-bases/${kbId}/sources`);
            const indexed = (kbSources.items ?? []).find(
              (s: { id: string; source_id: string }) => s.source_id === id
            );
            if (indexed) {
              await pbDelete(`/api/knowledge-bases/${kbId}/sources/${indexed.id}`);
            }
            // Update the source name to remove this kbId from our tracking field
            const newKbField = kbIds.filter((k) => k !== kbId).join("+");
            const newName = [parts[0], newKbField, ...parts.slice(2)].join(":");
            await pbPatch(`/api/sources/${id}`, { name: newName });
            return applyRefresh(NextResponse.json({ success: true }));
          }
        }
      }
    }

    // Single-KB source (or no agentId) — delete entirely
    await pbDelete(`/api/sources/${id}`);
    return applyRefresh(NextResponse.json({ success: true }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
