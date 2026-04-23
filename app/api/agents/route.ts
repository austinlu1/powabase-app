/**
 * GET  /api/agents          → list all agents
 * POST /api/agents          → create an agent
 */
import { NextRequest, NextResponse } from "next/server";
import { pbGet, pbPost } from "@/lib/powabase-server";

export async function GET() {
  try {
    const data = await pbGet("/api/agents");
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = await pbPost("/api/agents", body);
    return NextResponse.json(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
