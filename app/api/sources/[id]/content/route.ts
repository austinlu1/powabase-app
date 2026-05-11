/**
 * GET /api/sources/[id]/content
 * Fetches the extracted text content of a source using Powabase's
 * derivative download endpoint. Prefers markdown, falls back to plain text.
 */
import { NextRequest, NextResponse } from "next/server";
import { POWABASE_URL, powabaseHeaders } from "@/lib/powabase-server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Try markdown first, then plain text
    for (const type of ["markdown", "text"]) {
      const res = await fetch(
        `${POWABASE_URL}/api/sources/${id}/derivatives/${type}/download`,
        { headers: powabaseHeaders() }
      );

      if (res.ok) {
        const content = await res.text();
        return NextResponse.json({ content, isMarkdown: type === "markdown" });
      }
    }

    return NextResponse.json({ error: "No text content available yet" }, { status: 404 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
