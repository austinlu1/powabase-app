/**
 * POST /api/upload
 * Accepts multipart form with a "file" field.
 * 1. Gets the authenticated user from cookie
 * 2. Looks up their KB from user_agents table
 * 3. Uploads file to Powabase as a Source
 * 4. Waits for extraction to complete
 * 5. Attaches source to the user's KB
 * 6. Records the source in user_sources table
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbGet, pbPost, pbPatch, pbDelete, pbPostForm, listAgentsWithDescription, parseAgentName } from "@/lib/powabase-server";

/** Poll until the source extraction_status is "extracted" or "failed" */
async function waitForExtraction(sourceId: string, timeoutMs = 60000): Promise<void> {
  const interval = 2000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const source = await pbGet(`/api/sources/${sourceId}`);
    const status: string = source.extraction_status ?? source.status;
    if (status === "extracted" || status === "completed") return;
    if (status === "failed") throw new Error(`Source extraction failed: ${source.error_message ?? "unknown"}`);
    await new Promise((r) => setTimeout(r, interval));
  }

  throw new Error("Source extraction timed out after 60s");
}

export async function POST(req: NextRequest) {
  try {
    // 1. Get authenticated user
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    const agentIdParam = form.get("agentId") as string | null;
    if (!agentIdParam) return NextResponse.json({ error: "agentId required" }, { status: 400 });

    // 2. Look up the specific agent and verify ownership
    const allAgents = await listAgentsWithDescription();
    const userAgent = allAgents.find((a) => a.id === agentIdParam);
    if (!userAgent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    const meta = parseAgentName(userAgent.name);
    if (!meta || meta.uid !== user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    const kbId: string = meta.kid;
    const agentId: string = userAgent.id;

    // 3. Upload source — name format: "{userId}:{kbId}:{uuid}:{filename}"
    //    userId = owner filter, kbId = KB attribution, uuid = uniqueness, filename = display
    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("name", `${user.id}:${kbId}:${crypto.randomUUID()}:${file.name}`);
    let source: { id: string; extraction_status?: string };
    try {
      source = await pbPostForm("/api/sources/upload", uploadForm);
    } catch (e: unknown) {
      const err = e as { status?: number; body?: Record<string, unknown> };
      if (err.status === 409) {
        // Powabase deduplicates by content — find the existing source and reuse it
        const errSource = err.body?.source as Record<string, unknown> | undefined;
        let existingId: string | null =
          (err.body?.id ?? err.body?.source_id ?? errSource?.id ?? null) as string | null;

        if (!existingId) {
          // Fall back: search all sources for one matching this filename
          const allSources = await pbGet("/api/sources");
          const match = (allSources.sources ?? []).find(
            (s: { id: string; name?: string }) =>
              s.name?.startsWith(`${user.id}:`) && s.name?.endsWith(`:${file.name}`)
          );
          if (!match) {
            return NextResponse.json({ error: "duplicate", message: "This document has already been uploaded to this agent." }, { status: 409 });
          }
          existingId = match.id;
        }
        source = { id: existingId as string };

        // Append the new kbId to the source name so it shows under this agent's sources list.
        // Name format: "{userId}:{kbA}+{kbB}:{uuid}:{filename}" (kbIds joined by "+")
        try {
          const existing = await pbGet(`/api/sources/${existingId}`);
          const parts = (existing.name as string ?? "").split(":");
          if (parts.length >= 3) {
            const currentKbIds = parts[1].split("+");
            if (!currentKbIds.includes(kbId)) {
              const newName = [parts[0], [...currentKbIds, kbId].join("+"), ...parts.slice(2)].join(":");
              await pbPatch(`/api/sources/${existingId}`, { name: newName });
            }
          }
        } catch {
          // PATCH may not be supported — source won't appear in second agent's list but is still usable
        }
      } else {
        throw e;
      }
    }

    // 4. Wait for extraction only if not already done
    const status: string = source.extraction_status ?? "";
    if (status !== "extracted" && status !== "completed") {
      await waitForExtraction(source.id);
    }

    // 4b. Enforce 25-page limit
    const sourceDetails = await pbGet(`/api/sources/${source.id}`);
    const pageCount: number = sourceDetails.auto_metadata?.page_count ?? 0;
    if (pageCount > 25) {
      try { await pbDelete(`/api/sources/${source.id}`); } catch { /* best effort */ }
      return NextResponse.json(
        { error: "File too large", message: "This file exceeds the 25-page limit. Please upload a smaller document." },
        { status: 400 }
      );
    }

    // 5. Attach source to the user's KB
    try {
      await pbPost(`/api/knowledge-bases/${kbId}/sources`, { source_id: source.id });
    } catch (e: unknown) {
      if (String(e).includes("404")) {
        return NextResponse.json({ error: "Agent setup required", message: "This agent's knowledge base is missing. Please reload the page to repair it." }, { status: 400 });
      }
      throw e;
    }

    // 6. Attach KB to agent if not already (409 = already attached, ignore)
    try {
      await pbPost(`/api/agents/${agentId}/knowledge-bases`, { knowledge_base_id: kbId });
    } catch (e: unknown) {
      if (!String(e).includes("409")) throw e;
    }

    return applyRefresh(NextResponse.json({ source, kbId }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
