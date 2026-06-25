/**
 * POST /api/auth/reset-password
 * Body: { email }
 * Sends a password reset email via Powabase GoTrue.
 * Always returns 200 to avoid leaking whether an email exists.
 */
import { NextRequest, NextResponse } from "next/server";
import { POWABASE_URL } from "@/lib/powabase-server";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

    await fetch(`${POWABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: {
        apikey: process.env.POWABASE_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email }),
    });

    // Always return 200 — don't reveal whether the email exists
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
