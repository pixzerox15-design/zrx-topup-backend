function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

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

  return base64url(new Uint8Array(signature));
}

export async function onRequestPost({ request, env }) {
  try {
    if (!env.ADMIN_PASSWORD || !env.ADMIN_SESSION_SECRET) {
      return Response.json(
        { success: false, message: "Admin settings missing" },
        { status: 500 }
      );
    }

    const origin = request.headers.get("Origin");

    if (origin && origin !== new URL(request.url).origin) {
      return Response.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const data = await request.json();
    const password = String(data.password || "");

    if (password !== env.ADMIN_PASSWORD) {
      return Response.json(
        { success: false, message: "Wrong password" },
        { status: 401 }
      );
    }

    const expires = Math.floor(Date.now() / 1000) + 28800;

    const payload = base64url(
      new TextEncoder().encode(JSON.stringify({ expires }))
    );

    const signature = await createSignature(
      payload,
      env.ADMIN_SESSION_SECRET
    );

    const token = `${payload}.${signature}`;

    return Response.json(
      { success: true, message: "Login successful" },
      {
        headers: {
          "Set-Cookie": `zrx_admin_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800`,
          "Cache-Control": "no-store"
        }
      }
    );
  } catch {
    return Response.json(
      { success: false, message: "Login failed" },
      { status: 500 }
    );
  }
}
