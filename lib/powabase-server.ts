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
