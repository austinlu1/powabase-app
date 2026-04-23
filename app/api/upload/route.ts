/**
 * POST /api/upload
 * Accepts multipart form with a "file" field.
 * 1. Uploads file to Powabase as a Source
 * 2. Gets or creates the default Knowledge Base
 * 3. Attaches the source to the KB
 * 4. Attaches the KB to the agent (if agentId provided)
 *
 * Powabase handles all extraction and indexing asynchronously.
 */
import { NextRequest, NextResponse } from "next/server";
import { pbGet, pbPost, pbPostForm } from "@/lib/powabase-server";

const DEFAULT_KB_NAME = "default-knowledge-base";

async function getOrCreateKB() {
  const { knowledge_bases } = await pbGet("/api/knowledge-bases");
  const existing = (knowledge_bases as { id: string; name: string }[]).find(
    (kb) => kb.name === DEFAULT_KB_NAME
  );
  if (existing) return existing;

  return pbPost("/api/knowledge-bases", {
    name: DEFAULT_KB_NAME,
    indexing_config: {
      strategy: "chunk_embed",
      chunk_size: 2000,
      overlap: 50,
      embedding_model: "text-embedding-3-small",
    },
    retrieval_config: {
      method: "hybrid",
      top_k: 10,
      vector_weight: 0.6,
    },
  });
}

/** Poll until the source extraction_status is "completed" or "failed" */
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
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const agentId = form.get("agentId") as string | null;

    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    // 1. Upload source to Powabase
    const uploadForm = new FormData();
    uploadForm.append("file", file);
    const source = await pbPostForm("/api/sources/upload", uploadForm);

    // 2. Wait for Powabase to finish extracting the file before indexing
    await waitForExtraction(source.id);

    // 3. Get or create the default KB
    const kb = await getOrCreateKB();

    // 4. Attach source to KB (triggers async indexing in Powabase)
    await pbPost(`/api/knowledge-bases/${kb.id}/sources`, { source_id: source.id });

    // 5. Attach KB to agent so it gets a knowledge_search tool automatically
    // 409 means it's already attached — that's fine, treat it as success
    if (agentId) {
      try {
        await pbPost(`/api/agents/${agentId}/knowledge-bases`, { knowledge_base_id: kb.id });
      } catch (e: unknown) {
        if (!String(e).includes("409")) throw e;
      }
    }

    return NextResponse.json({ source, kb });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
