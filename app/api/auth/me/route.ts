/**
 * GET  /api/auth/me  → returns current user
 * PATCH /api/auth/me → updates display name (user_metadata.username)
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

export async function PATCH(req: NextRequest) {
  const token = req.cookies.get("pb_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { display_name } = await req.json();
    if (!display_name?.trim()) return NextResponse.json({ error: "display_name required" }, { status: 400 });

    const res = await fetch(`${POWABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data: { username: display_name.trim() } }),
    });

    if (!res.ok) return NextResponse.json({ error: "Failed to update" }, { status: res.status });
    const user = await res.json();
    return NextResponse.json({ user });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
