
function base64urlToBytes(value) {
  const base64 = value
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const padded = base64 + "=".repeat((4 - base64.length % 4) % 4);
  const binary = atob(padded);

  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function verifySession(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return false;

    const [payload, signature] = parts;

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBytes(signature),
      new TextEncoder().encode(payload)
    );

    if (!valid) return false;

    const data = JSON.parse(
      new TextDecoder().decode(base64urlToBytes(payload))
    );

    return Number(data.expires) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export async function onRequestGet({ request, env }) {
  try {
    if (!env.ADMIN_SESSION_SECRET || !env.DB) {
      return Response.json(
        { success: false, message: "Server settings missing" },
        { status: 500 }
      );
    }

    const cookie = request.headers.get("Cookie") || "";
    const match = cookie.match(
      /(?:^|;\s*)zrx_admin_session=([^;]+)/
    );

    if (!match) {
      return Response.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const valid = await verifySession(
      match[1],
      env.ADMIN_SESSION_SECRET
    );

    if (!valid) {
      return Response.json(
        { success: false, message: "Session expired" },
        { status: 401 }
      );
    }

    const result = await env.DB.prepare(
      `SELECT id, player_uid, player_name,
       package_name, package_price, status, created_at
       FROM orders
       ORDER BY id DESC
       LIMIT 100`
    ).all();

    return Response.json(
      {
        success: true,
        orders: result.results || []
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch {
    return Response.json(
      { success: false, message: "Could not load orders" },
      { status: 500 }
    );
  }
}
