/**
 * POST /api/auth/logout
 * Clears auth cookies, ending the session.
 */
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete("pb_token");
  response.cookies.delete("pb_refresh");
  return response;
}
