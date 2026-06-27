"use client";

import { useEffect } from "react";

// Refresh the access token every 45 minutes (tokens expire after ~1 hour)
const REFRESH_INTERVAL_MS = 45 * 60 * 1000;

export default function TokenRefresher() {
  useEffect(() => {
    async function refresh() {
      try {
        await fetch("/api/auth/refresh", { method: "POST" });
      } catch {
        // silently fail — getUserFromCookie handles expired tokens per-request
      }
    }

    // Refresh immediately on mount to extend session if tab was inactive
    refresh();

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  return null;
}
