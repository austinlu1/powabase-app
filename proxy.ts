/**
 * Next.js middleware — runs on every request before the page loads.
 * Checks for a valid auth cookie and redirects unauthenticated users to /login.
 */
import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const token = req.cookies.get("pb_token")?.value;
  const { pathname } = req.nextUrl;

  // Allow auth routes and login page through always
  if (pathname.startsWith("/api/auth") || pathname.startsWith("/login")) {
    return NextResponse.next();
  }

  // Protect everything else — redirect to login if no token
  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
