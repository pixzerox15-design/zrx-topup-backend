const packages = {
  "100": 80,
  "200": 150,
  "310": 240,
  "520": 350,
  "1060": 720,
  "2180": 1450
};

export async function onRequestPost({ request, env }) {
  try {
    if (!env.DB) {
      return Response.json(
        { success: false, message: "Database not connected" },
        { status: 500 }
      );
    }

    const data = await request.json();

    const uid = String(data.uid || "").trim();
    const name = String(data.name || "").trim();
    const amount = String(data.amount || "").trim();
    const price = packages[amount];

    if (!/^\d{5,20}$/.test(uid) || !price) {
      return Response.json(
        { success: false, message: "Invalid order details" },
        { status: 400 }
      );
    }

    await env.DB.prepare(
      `INSERT INTO orders
       (player_uid, player_name, package_name, package_price)
       VALUES (?, ?, ?, ?)`
    ).bind(
      uid,
      name.slice(0, 50),
      amount + " Diamonds",
      price
    ).run();

    return Response.json({
      success: true,
      message: "Demo order saved"
    });

  } catch (error) {
    return Response.json(
      { success: false, message: "Could not save demo order" },
      { status: 500 }
    );
  }
        }
