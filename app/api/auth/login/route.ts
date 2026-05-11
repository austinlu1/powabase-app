/**
 * POST /api/auth/login
 * Authenticates a user via Powabase GoTrue and sets httpOnly auth cookies.
 * The access_token is stored in a cookie — never exposed to the browser as JS.
 */
import { NextRequest, NextResponse } from "next/server";
import { POWABASE_URL } from "@/lib/powabase-server";
import { setAuthCookies } from "../signup/route";

const ANON_KEY = process.env.POWABASE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const res = await fetch(`${POWABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.error_description ?? data.msg ?? "Invalid credentials" }, { status: 401 });
    }

    return setAuthCookies(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
