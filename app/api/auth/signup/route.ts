/**
 * POST /api/auth/signup
 * Creates a new user via Powabase GoTrue, then sets auth cookies.
 */
import { NextRequest, NextResponse } from "next/server";
import { POWABASE_URL } from "@/lib/powabase-server";

const ANON_KEY = process.env.POWABASE_KEY!;

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const res = await fetch(`${POWABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({ error: data.msg ?? data.error ?? data.message ?? JSON.stringify(data) }, { status: res.status });
    }

    return setAuthCookies(data);
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export function setAuthCookies(data: {
  access_token: string;
  refresh_token: string;
  user: { id: string; email: string };
}) {
  const response = NextResponse.json({ user: data.user });
  const maxAge = 60 * 60 * 24 * 30; // 30 days

  response.cookies.set("pb_token", data.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
  response.cookies.set("pb_refresh", data.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  return response;
}
