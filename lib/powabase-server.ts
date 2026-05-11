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
  if (!res.ok) throw new Error(`PostgREST GET ${table} → ${res.status}`);
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

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function getUserFromCookie(
  req: import("next/server").NextRequest
): Promise<{ id: string; email: string } | null> {
  const token = req.cookies.get("pb_token")?.value;
  if (!token) return null;

  const res = await fetch(`${POWABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: process.env.POWABASE_KEY!,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) return null;

  const user = await res.json();
  return { id: user.id, email: user.email };
}
