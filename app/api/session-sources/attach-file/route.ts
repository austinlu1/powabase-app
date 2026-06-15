/**
 * POST /api/session-sources/attach-file
 * Multipart form: { file }
 * Uploads a file to Powabase purely for text extraction, fetches the
 * markdown derivative, deletes the source, and returns the extracted text.
 * The source is never attached to any KB — it's session-scoped context only.
 */
import { NextRequest, NextResponse } from "next/server";
import { getUserFromCookie, pbPostForm, pbGet, pbDelete, POWABASE_URL, powabaseHeaders } from "@/lib/powabase-server";

async function waitForExtraction(sourceId: string, timeoutMs = 120000): Promise<void> {
  const interval = 2000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const source = await pbGet(`/api/sources/${sourceId}`);
    const status: string = source.extraction_status ?? source.status ?? "";
    if (status === "extracted" || status === "completed") return;
    if (status === "failed") throw new Error(`Extraction failed: ${source.error_message ?? "unknown"}`);
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Extraction timed out");
}

async function getExtractedText(sourceId: string): Promise<string> {
  for (const type of ["markdown", "text"]) {
    const res = await fetch(
      `${POWABASE_URL}/api/sources/${sourceId}/derivatives/${type}/download`,
      { headers: powabaseHeaders() }
    );
    if (res.ok) return res.text();
  }
  // Fall back to page-texts
  const data = await pbGet(`/api/sources/${sourceId}/page-texts`);
  const pages: { text: string }[] = data.pages ?? data.page_texts ?? [];
  return pages.map((p) => p.text).join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const { user, applyRefresh } = await getUserFromCookie(req);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    // Upload to Powabase for extraction only
    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("name", `session-tmp-${user.id}-${crypto.randomUUID()}-${file.name}`);

    let source: { id: string; extraction_status?: string };
    try {
      source = await pbPostForm("/api/sources/upload", uploadForm);
    } catch (e: unknown) {
      const err = e as { status?: number; body?: Record<string, unknown> };
      if (err.status === 409) {
        // Already exists — get the source ID and reuse
        const existingId = (err.body?.id ?? err.body?.source_id ?? null) as string | null;
        if (!existingId) return NextResponse.json({ error: "Duplicate file, could not resolve source ID" }, { status: 409 });
        source = { id: existingId, extraction_status: "extracted" };
      } else {
        throw e;
      }
    }

    // Wait for extraction if needed
    const status = source.extraction_status ?? "";
    if (status !== "extracted" && status !== "completed") {
      await waitForExtraction(source.id, 300000); // 5 min
    }

    // Enforce 25-page limit
    const sourceDetails = await pbGet(`/api/sources/${source.id}`);
    const pageCount: number = sourceDetails.auto_metadata?.page_count ?? 0;
    if (pageCount > 25) {
      try { await pbDelete(`/api/sources/${source.id}`); } catch { /* best effort */ }
      return NextResponse.json(
        { error: "File too large", message: "This file exceeds the 25-page limit. Please upload a smaller document." },
        { status: 400 }
      );
    }

    // Get extracted text
    const extractedText = await getExtractedText(source.id);

    // Delete source from Powabase — we only needed it for extraction
    try { await pbDelete(`/api/sources/${source.id}`); } catch { /* best effort */ }

    return applyRefresh(NextResponse.json({
      id: crypto.randomUUID(),
      name: file.name,
      type: "file",
      extractedText,
    }));
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
