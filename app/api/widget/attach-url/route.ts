/**
 * POST /api/widget/attach-url
 * Public (no auth) — body: { url: string }
 * Imports a URL to Powabase for extraction, fetches the markdown,
 * deletes the source, and returns the extracted text.
 */
import { NextRequest, NextResponse } from "next/server";
import { pbGet, pbDelete, POWABASE_URL, powabaseHeaders } from "@/lib/powabase-server";

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

function extractSourceId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.source_id === "string") return d.source_id;
  if (typeof d.id === "string") return d.id;
  if (d.source && typeof (d.source as Record<string, unknown>).id === "string")
    return (d.source as Record<string, unknown>).id as string;
  const arr = (d.sources ?? d) as unknown[];
  if (Array.isArray(arr) && arr.length > 0) {
    const first = arr[0] as Record<string, unknown>;
    if (typeof first.id === "string") return first.id;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ error: "url required" }, { status: 400, headers: CORS });
    try { new URL(url); } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400, headers: CORS });
    }

    const beforeData = await pbGet("/api/sources");
    const beforeIds = new Set<string>((beforeData.sources ?? []).map((s: { id: string }) => s.id));

    const importRes = await fetch(`${POWABASE_URL}/api/sources/import-url`, {
      method: "POST",
      headers: powabaseHeaders(),
      body: JSON.stringify({ mode: "urls", urls: [url] }),
    });
    if (!importRes.ok) {
      const text = await importRes.text();
      return NextResponse.json({ error: `Import failed: ${text}` }, { status: 502, headers: CORS });
    }

    const importData = await importRes.json();
    let sourceId = extractSourceId(importData);

    if (!sourceId) {
      const afterData = await pbGet("/api/sources");
      const newSource = (afterData.sources ?? []).find((s: { id: string }) => !beforeIds.has(s.id));
      sourceId = newSource?.id ?? null;
    }

    if (!sourceId) {
      return NextResponse.json({ error: "Could not identify imported source" }, { status: 502, headers: CORS });
    }

    await waitForExtraction(sourceId);
    const extractedText = await getExtractedText(sourceId);
    try { await pbDelete(`/api/sources/${sourceId}`); } catch { /* best effort */ }

    return NextResponse.json(
      { id: crypto.randomUUID(), name: url, type: "url", extractedText },
      { headers: CORS }
    );
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500, headers: CORS });
  }
}
