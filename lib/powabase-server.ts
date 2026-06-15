/**
 * Server-only Powabase helpers.
 * NEVER import this file from client components — it reads the secret key.
 * Only used inside app/api/** route handlers.
 */

export const POWABASE_URL = process.env.POWABASE_URL!;

export function powabaseHeaders(contentType = "application/json") {
  const key = process.env.POWABASE_KEY!;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": contentType,
  };
}

export async function pbGet(path: string) {
  const res = await fetch(`${POWABASE_URL}${path}`, {
    headers: powabaseHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Powabase GET ${path} → ${res.status}`);
  return res.json();
}

export async function pbPost(path: string, body: unknown) {
  const res = await fetch(`${POWABASE_URL}${path}`, {
    method: "POST",
    headers: powabaseHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Powabase POST ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

export async function pbPatch(path: string, body: unknown) {
  const res = await fetch(`${POWABASE_URL}${path}`, {
    method: "PATCH",
    headers: powabaseHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Powabase PATCH ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

export async function pbDelete(path: string) {
  const res = await fetch(`${POWABASE_URL}${path}`, {
    method: "DELETE",
    headers: powabaseHeaders(),
  });
  if (!res.ok) throw new Error(`Powabase DELETE ${path} → ${res.status}`);
  return res.status === 204 ? {} : res.json();
}

export async function pbPostForm(path: string, form: FormData) {
  const key = process.env.POWABASE_KEY!;
  const res = await fetch(`${POWABASE_URL}${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: form,
  });
  if (res.status === 409) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(`Powabase POST (form) ${path} → 409`) as Error & { status: number; body: Record<string, unknown> };
    err.status = 409;
    err.body = body;
    throw err;
  }
  if (!res.ok) throw new Error(`Powabase POST (form) ${path} → ${res.status}`);
  return res.json();
}

// ── PostgREST helpers (/rest/v1) ─────────────────────────────────────────────

function restHeaders(prefer?: string) {
  const key = process.env.POWABASE_KEY!;
  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers["Prefer"] = prefer;
  return headers;
}

export async function pbRestGet<T = Record<string, unknown>>(
  table: string,
  params: Record<string, string> = {}
): Promise<T[]> {
  const query = new URLSearchParams(params).toString();
  const url = `${POWABASE_URL}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const res = await fetch(url, { headers: restHeaders(), cache: "no-store" });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostgREST GET ${table} → ${res.status}: ${text}`);
  }
  return res.json();
}

export async function pbRestPost(
  table: string,
  body: Record<string, unknown>,
  prefer?: string
): Promise<void> {
  const res = await fetch(`${POWABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: restHeaders(prefer),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PostgREST POST ${table} → ${res.status}: ${text}`);
  }
}

export async function pbRestDelete(
  table: string,
  params: Record<string, string>
): Promise<void> {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(`${POWABASE_URL}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: restHeaders(),
  });
  if (!res.ok) throw new Error(`PostgREST DELETE ${table} → ${res.status}`);
}

// ── Agent helpers ─────────────────────────────────────────────────────────────

/**
 * Agent names are stored as "{userId}__{kbId}__{displayName}".
 * This encodes ownership directly in the name field, which is always returned
 * by GET /api/agents — no separate table or description field needed.
 */
export function parseAgentName(name: string): { uid: string; kid: string; displayName: string } | null {
  const parts = name.split("__");
  if (parts.length < 3) return null;
  const [uid, kid, ...rest] = parts;
  if (!uid || !kid) return null;
  return { uid, kid, displayName: rest.join("__") };
}

export function buildAgentName(userId: string, kbId: string, displayName: string): string {
  return `${userId}__${kbId}__${displayName}`;
}

export async function listAgentsWithDescription(): Promise<
  { id: string; name: string; system_prompt: string; model: string; created_at: string }[]
> {
  const data = await pbGet("/api/agents");
  return data.agents ?? [];
}

// ── Auth ─────────────────────────────────────────────────────────────────────

const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE,
};

type ApplyRefresh = (res: import("next/server").NextResponse) => import("next/server").NextResponse;
const noRefresh: ApplyRefresh = (res) => res;

export async function getUserFromCookie(
  req: import("next/server").NextRequest
): Promise<{ user: { id: string; email: string } | null; applyRefresh: ApplyRefresh }> {
  const token = req.cookies.get("pb_token")?.value;
  const refreshToken = req.cookies.get("pb_refresh")?.value;
  if (!token) return { user: null, applyRefresh: noRefresh };

  const res = await fetch(`${POWABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.POWABASE_KEY!,
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.ok) {
    const user = await res.json();
    // Roll the cookie expiry forward on every successful request
    const applyRefresh: ApplyRefresh = (response) => {
      response.cookies.set("pb_token", token, COOKIE_OPTS);
      if (refreshToken) response.cookies.set("pb_refresh", refreshToken, COOKIE_OPTS);
      return response;
    };
    return { user: { id: user.id, email: user.email }, applyRefresh };
  }

  // Token expired — attempt refresh
  if (res.status === 401) {
    if (!refreshToken) return { user: null, applyRefresh: noRefresh };

    const refreshRes = await fetch(`${POWABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: process.env.POWABASE_KEY!, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!refreshRes.ok) return { user: null, applyRefresh: noRefresh };

    const data = await refreshRes.json();
    const applyRefresh: ApplyRefresh = (response) => {
      response.cookies.set("pb_token", data.access_token, COOKIE_OPTS);
      response.cookies.set("pb_refresh", data.refresh_token, COOKIE_OPTS);
      return response;
    };

    return { user: { id: data.user.id, email: data.user.email }, applyRefresh };
  }

  return { user: null, applyRefresh: noRefresh };
}
