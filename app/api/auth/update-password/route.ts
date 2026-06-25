/**
 * POST /api/auth/update-password
 * Body: { accessToken, password }
 * Updates the user's password using the access token from the reset email link.
 */
import { NextRequest, NextResponse } from "next/server";
import { POWABASE_URL } from "@/lib/powabase-server";

export async function POST(req: NextRequest) {
  try {
    const { accessToken, password } = await req.json();
    if (!accessToken || !password) {
      return NextResponse.json({ error: "accessToken and password required" }, { status: 400 });
    }

    const res = await fetch(`${POWABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: process.env.POWABASE_KEY!,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password }),
    });

    if (!res.ok) {
      const data = await res.json();
      return NextResponse.json({ error: data.msg ?? data.error ?? "Failed to update password" }, { status: res.status });
    }

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
