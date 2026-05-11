/**
 * GET /api/auth/me
 * Returns the current authenticated user by reading the httpOnly cookie
 * and verifying it with Powabase GoTrue.
 */
import { NextRequest, NextResponse } from "next/server";
import { POWABASE_URL } from "@/lib/powabase-server";

const ANON_KEY = process.env.POWABASE_KEY!;

export async function GET(req: NextRequest) {
  const token = req.cookies.get("pb_token")?.value;
  if (!token) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  try {
    const res = await fetch(`${POWABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    const user = await res.json();
    return NextResponse.json({ user });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
