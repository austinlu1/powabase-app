/**
 * POST /api/auth/refresh
 * Uses the stored refresh token to get a new access token.
 * Called proactively by the frontend before the token expires.
 */
import { NextRequest, NextResponse } from "next/server";
import { POWABASE_URL } from "@/lib/powabase-server";
import { setAuthCookies } from "../signup/route";

export async function POST(req: NextRequest) {
  const refreshToken = req.cookies.get("pb_refresh")?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
  }

  const res = await fetch(`${POWABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: {
      apikey: process.env.POWABASE_KEY!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const data = await res.json();
  return setAuthCookies(data);
}
