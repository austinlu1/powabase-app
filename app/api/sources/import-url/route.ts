/**
 * POST /api/sources/import-url
 * Body: { url: string, agentId: string }
 * Imports a website URL as a source, attaches it to the agent's KB.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbPost, pbPatch, pbGet, listAgentsWithDescription, parseAgentName, POWABASE_URL, powabaseHeaders } from "@/lib/powabase-server";

async function waitForExtraction(sourceId: string, timeoutMs = 60000): Promise<void> {
  const interval = 2000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const source = await pbGet(`/api/sources/${sourceId}`);
    const status: string = source.extraction_status ?? source.status ?? "";
    if (status === "extracted" || status === "completed") return;
    if (status === "failed") throw new Error(`Extraction failed: ${source.error_message ?? "unknown"}`);
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Extraction timed out after 60s");
}

/** Extract source ID from any shape Powabase might return */
function extractSourceId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  // Scalar fields
  if (typeof d.source_id === "string") return d.source_id;
  if (typeof d.id === "string") return d.id;

  // Nested object
  if (d.source && typeof (d.source as Record<string, unknown>).id === "string")
    return (d.source as Record<string, unknown>).id as string;

  // Array of sources
  const arr = (d.sources ?? d) as unknown[];
  if (Array.isArray(arr) && arr.length > 0) {
    const first = arr[0] as Record<string, unknown>;
    if (typeof first.id === "string") return first.id;
    if (typeof first.source_id === "string") return first.source_id;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { url, agentId } = await req.json();
    if (!url || !agentId) return NextResponse.json({ error: "url and agentId required" }, { status: 400 });

    try { new URL(url); } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    // Verify agent ownership
    const allAgents = await listAgentsWithDescription();
    const agent = allAgents.find((a) => a.id === agentId);
    const meta = agent ? parseAgentName(agent.name) : null;
    if (!meta || meta.uid !== user.id) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    const kbId = meta.kid;

    // Snapshot existing source IDs so we can find the new one if needed
    const beforeData = await pbGet("/api/sources");
    const beforeIds = new Set<string>(
      (beforeData.sources ?? []).map((s: { id: string }) => s.id)
    );

    // Import URL via Powabase
    const importRes = await fetch(`${POWABASE_URL}/api/sources/import-url`, {
      method: "POST",
      headers: powabaseHeaders(),
      body: JSON.stringify({ mode: "urls", urls: [url] }),
    });

    if (!importRes.ok) {
      const text = await importRes.text();
      return NextResponse.json({ error: `Import failed: ${text}` }, { status: 502 });
    }

    const importData = await importRes.json();
    console.log("[import-url] importData:", JSON.stringify(importData));
    let sourceId = extractSourceId(importData);
    console.log("[import-url] sourceId from response:", sourceId);

    // Fallback: find the new source by diffing before/after
    if (!sourceId) {
      const afterData = await pbGet("/api/sources");
      const newSource = (afterData.sources ?? []).find(
        (s: { id: string }) => !beforeIds.has(s.id)
      );
      sourceId = newSource?.id ?? null;
      console.log("[import-url] sourceId from diff:", sourceId);
    }

    if (!sourceId) {
      return NextResponse.json(
        { error: "Could not identify the imported source. Check Powabase directly." },
        { status: 502 }
      );
    }

    // Wait for extraction FIRST — Powabase sets the name to the page title during extraction
    // so we must PATCH after extraction completes or it gets overwritten
    await waitForExtraction(sourceId, 300000); // 5 min — Firecrawl can be slow

    // Encode ownership in the source name after extraction is done
    const encodedName = `${user.id}:${kbId}:${crypto.randomUUID()}:${url}`;
    console.log("[import-url] PATCHing name to:", encodedName);
    await pbPatch(`/api/sources/${sourceId}`, { name: encodedName });
    console.log("[import-url] PATCH succeeded");

    // Attach to KB
    try {
      await pbPost(`/api/knowledge-bases/${kbId}/sources`, { source_id: sourceId });
    } catch (e: unknown) {
      if (String(e).includes("404")) {
        return NextResponse.json({
          error: "Agent setup required",
          message: "This agent's knowledge base is missing. Please reload the page.",
        }, { status: 400 });
      }
      throw e;
    }

    // Attach KB to agent (409 = already attached, ignore)
    try {
      await pbPost(`/api/agents/${agentId}/knowledge-bases`, { knowledge_base_id: kbId });
    } catch (e: unknown) {
      if (!String(e).includes("409")) throw e;
    }

    const source = await pbGet(`/api/sources/${sourceId}`);
    return applyRefresh(NextResponse.json({ source, kbId }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
