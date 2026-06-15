/**
 * POST /api/widget/attach-file
 * Public (no auth) — multipart form: { file }
 * Uploads a file to Powabase for text extraction, fetches the markdown,
 * deletes the source, and returns the extracted text.
 * Identical extraction logic to /api/session-sources/attach-file but public.
 */
import { NextRequest, NextResponse } from "next/server";
import { pbPostForm, pbGet, pbDelete, POWABASE_URL, powabaseHeaders } from "@/lib/powabase-server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

async function waitForExtraction(sourceId: string, timeoutMs = 300000): Promise<void> {
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
  const data = await pbGet(`/api/sources/${sourceId}/page-texts`);
  const pages: { text: string }[] = data.pages ?? data.page_texts ?? [];
  return pages.map((p) => p.text).join("\n\n");
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "file required" }, { status: 400, headers: CORS });
    }

    const uploadForm = new FormData();
    uploadForm.append("file", file);
    uploadForm.append("name", `widget-tmp-${crypto.randomUUID()}-${file.name}`);

    let source: { id: string; extraction_status?: string };
    try {
      source = await pbPostForm("/api/sources/upload", uploadForm);
    } catch (e: unknown) {
      const err = e as { status?: number; body?: Record<string, unknown> };
      if (err.status === 409) {
        const existingId = (err.body?.id ?? err.body?.source_id ?? null) as string | null;
        if (!existingId) {
          return NextResponse.json({ error: "Duplicate file, could not resolve source ID" }, { status: 409, headers: CORS });
        }
        source = { id: existingId, extraction_status: "extracted" };
      } else {
        throw e;
      }
    }

    const status = source.extraction_status ?? "";
    if (status !== "extracted" && status !== "completed") {
      await waitForExtraction(source.id);
    }

    // Enforce 25-page limit
    const sourceDetails = await pbGet(`/api/sources/${source.id}`);
    const pageCount: number = sourceDetails.auto_metadata?.page_count ?? 0;
    if (pageCount > 25) {
      try { await pbDelete(`/api/sources/${source.id}`); } catch { /* best effort */ }
      return NextResponse.json(
        { error: "File too large", message: "This file exceeds the 25-page limit. Please upload a smaller document." },
        { status: 400, headers: CORS }
      );
    }

    const extractedText = await getExtractedText(source.id);
    try { await pbDelete(`/api/sources/${source.id}`); } catch { /* best effort */ }

    return NextResponse.json(
      { id: crypto.randomUUID(), name: file.name, type: "file", extractedText },
      { headers: CORS }
    );
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS });
  }
}
