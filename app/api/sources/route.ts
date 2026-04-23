/**
 * GET /api/sources → list all uploaded sources and their status
 */
import { NextResponse } from "next/server";
import { pbGet } from "@/lib/powabase-server";

export async function GET() {
  try {
    const data = await pbGet("/api/sources");
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
