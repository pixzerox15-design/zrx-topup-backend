async function createSignature(payload, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  return btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function verifySession(request, secret) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(/(?:^|;\s*)zrx_admin_session=([^;]+)/);

  if (!match) return false;

  const parts = match[1].split(".");
  if (parts.length !== 2) return false;

  const [payload, signature] = parts;
  const expected = await createSignature(payload, secret);

  if (signature !== expected) return false;

  try {
    const decoded = atob(
      payload.replace(/-/g, "+").replace(/_/g, "/")
    );

    const session = JSON.parse(decoded);

    return Number.isInteger(session.expires) &&
      session.expires > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.DB || !env.ADMIN_SESSION_SECRET) {
      return Response.json(
        { success: false, message: "Server configuration missing" },
        { status: 500 }
      );
    }

    if (!(await verifySession(request, env.ADMIN_SESSION_SECRET))) {
      return Response.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const result = await env.DB.prepare(
      `SELECT id, player_uid, player_name, package_name,
              package_price, status, created_at
       FROM orders
       ORDER BY id DESC
       LIMIT 100`
    ).all();

    return Response.json(
      { success: true, orders: result.results || [] },
      { headers: { "Cache-Control": "no-store" } }
    );

  } catch {
    return Response.json(
      { success: false, message: "Could not load orders" },
      { status: 500 }
    );
  }
}
