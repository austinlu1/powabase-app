/**
 * GET  /api/sources/[id]?agentId={agentId}  → fetch source content for viewer
 * DELETE /api/sources/[id]?agentId={agentId} → detach or fully delete source
 *
 * Ownership verified by kbId (not userId prefix) so cross-user content-dedup'd sources
 * are handled correctly — each user can independently view and delete their copy.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbGet, pbPatch, pbDelete, listAgentsWithDescription, parseAgentName, POWABASE_URL, powabaseHeaders } from "@/lib/powabase-server";

/** Fetch a file from Powabase storage by its storage_path. */
async function fetchStorageFile(storagePath: string): Promise<string> {
  // storage_path format: "{bucket}/{rest/of/path}"
  // Powabase storage endpoint: /storage/v1/object/{bucket}/{path}
  const url = `${POWABASE_URL}/storage/v1/object/${storagePath}`;
  const res = await fetch(url, { headers: powabaseHeaders("text/plain") });
  if (!res.ok) throw new Error(`Storage fetch failed: ${res.status}`);
  return res.text();
}

/** Resolve the caller's kbId and verify it appears in the source's name field. */
async function resolveOwnership(
  userId: string,
  agentId: string | null,
  sourceName: string
): Promise<{ kbId: string } | null> {
  if (!agentId) return null;
  const agents = await listAgentsWithDescription();
  const agent = agents.find((a) => a.id === agentId);
  if (!agent) return null;
  const meta = parseAgentName(agent.name);
  if (!meta || meta.uid !== userId) return null;
  const kbField = sourceName.split(":")[1] ?? "";
  if (!kbField.split("+").includes(meta.kid)) return null;
  return { kbId: meta.kid };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const agentId = req.nextUrl.searchParams.get("agentId");

    // Verify the agent belongs to this user — that's sufficient authorization
    // (the source is accessible if it's attached to an agent the user owns)
    if (agentId) {
      const agents = await listAgentsWithDescription();
      const agent = agents.find((a) => a.id === agentId);
      const meta = agent ? parseAgentName(agent.name) : null;
      if (!meta || meta.uid !== user.id) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }
    }

    const source = await pbGet(`/api/sources/${id}`);

    // Basic sanity check: source name must include the user's ID or kbId somewhere
    // (prevents fetching a completely unrelated source by guessing IDs)
    const sourceName: string = source.name ?? "";
    const nameParts = sourceName.split(":");
    const isRelated =
      nameParts[0] === user.id ||
      (agentId !== null && nameParts.length >= 2); // agentId verified above is sufficient
    if (!isRelated) {
      return NextResponse.json({ error: "Source not found" }, { status: 404 });
    }

    const displayName = nameParts.slice(3).join(":");

    const d = (source.derivatives ?? {}) as Record<string, unknown>;
    let content: string | null = null;

    // derivatives.markdown — may be a string or a storage pointer object
    const markdownDerivative = d.markdown;
    if (typeof markdownDerivative === "string" && markdownDerivative.trim()) {
      content = markdownDerivative;
    } else if (markdownDerivative && typeof markdownDerivative === "object") {
      const sp = (markdownDerivative as Record<string, unknown>).storage_path;
      if (typeof sp === "string") {
        try { content = await fetchStorageFile(sp); } catch { /* fall through to page_text */ }
      }
    }

    // derivatives.page_text — array of storage pointer objects {format, page, storage_path}
    if (!content) {
      const pageText = d.page_text;
      if (Array.isArray(pageText) && pageText.length > 0) {
        const texts = await Promise.all(
          pageText.map(async (p: unknown) => {
            if (typeof p === "string") return p;
            if (p && typeof p === "object") {
              const obj = p as Record<string, unknown>;
              // Inline text
              const inline = obj.text ?? obj.content ?? obj.body ?? obj.value;
              if (typeof inline === "string" && inline.trim()) return inline;
              // Storage pointer
              if (typeof obj.storage_path === "string") {
                try { return await fetchStorageFile(obj.storage_path as string); } catch { return ""; }
              }
            }
            return "";
          })
        );
        const nonEmpty = texts.filter(Boolean);
        if (nonEmpty.length > 0) {
          content = nonEmpty
            .map((t, i) => nonEmpty.length > 1 ? `--- Page ${i + 1} ---\n${t}` : t)
            .join("\n\n");
        }
      }
    }

    return applyRefresh(NextResponse.json({
      ...source,
      displayName,
      content,
    }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const agentId = req.nextUrl.searchParams.get("agentId");

    const source = await pbGet(`/api/sources/${id}`);
    const sourceName: string = source.name ?? "";

    // Verify caller owns this source via kbId
    const ownership = await resolveOwnership(user.id, agentId, sourceName);
    if (!ownership) {
      // Fallback: allow if source name starts with userId (backward compat, no agentId)
      if (sourceName.split(":")[0] !== user.id) {
        return NextResponse.json({ error: "Source not found" }, { status: 404 });
      }
    }

    const kbId = ownership?.kbId;

    if (kbId) {
      const parts = sourceName.split(":");
      if (parts.length >= 3) {
        const kbIds = parts[1].split("+");

        if (kbIds.length > 1 && kbIds.includes(kbId)) {
          // Source is shared across multiple KBs — detach only from this one
          const kbSources = await pbGet(`/api/knowledge-bases/${kbId}/sources`);
          const indexed = (kbSources.items ?? []).find(
            (s: { id: string; source_id: string }) => s.source_id === id
          );
          if (indexed) {
            await pbDelete(`/api/knowledge-bases/${kbId}/sources/${indexed.id}`);
          }
          const newKbField = kbIds.filter((k) => k !== kbId).join("+");
          const newName = [parts[0], newKbField, ...parts.slice(2)].join(":");
          await pbPatch(`/api/sources/${id}`, { name: newName });
          return applyRefresh(NextResponse.json({ success: true }));
        }
      }
    }

    // Only this KB references the source — delete entirely
    await pbDelete(`/api/sources/${id}`);
    return applyRefresh(NextResponse.json({ success: true }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
