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
import { getUserFromCookie, pbGet, pbPost, pbPostForm, pbRestGet, pbRestPost } from "@/lib/powabase-server";

interface UserAgentRow {
  agent_id: string;
  kb_id: string;
}

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
    const user = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    // 2. Look up the user's KB from user_agents table
    const rows = await pbRestGet<UserAgentRow>("user_agents", {
      user_id: `eq.${user.id}`,
      select: "agent_id,kb_id",
      limit: "1",
    });
    if (rows.length === 0) {
      return NextResponse.json({ error: "User not set up — visit the app first" }, { status: 400 });
    }
    const { kb_id: kbId, agent_id: agentId } = rows[0];

    // 3. Upload source to Powabase
    const uploadForm = new FormData();
    uploadForm.append("file", file);
    const source = await pbPostForm("/api/sources/upload", uploadForm);

    // 4. Wait for Powabase to finish extracting the file
    await waitForExtraction(source.id);

    // 5. Attach source to the user's KB
    await pbPost(`/api/knowledge-bases/${kbId}/sources`, { source_id: source.id });

    // 6. Attach KB to agent if not already (409 = already attached, ignore)
    try {
      await pbPost(`/api/agents/${agentId}/knowledge-bases`, { knowledge_base_id: kbId });
    } catch (e: unknown) {
      if (!String(e).includes("409")) throw e;
    }

    // 7. Record in user_sources table
    await pbRestPost(
      "user_sources",
      { user_id: user.id, source_id: source.id, name: file.name },
      "resolution=ignore-duplicates"
    );

    return NextResponse.json({ source, kbId });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
