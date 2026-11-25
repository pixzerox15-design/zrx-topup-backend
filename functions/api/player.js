
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const uid = (url.searchParams.get("uid") || "").trim();

    if (!/^\d{5,15}$/.test(uid)) {
      return Response.json(
        { success: false, message: "সঠিক UID লিখুন" },
        { status: 400 }
      );
    }

    if (!env.DB) {
      return Response.json(
        { success: false, message: "Database not connected" },
        { status: 500 }
      );
    }

    // প্রথমে নিজের ডেটাবেজে খুঁজবে
    const cached = await env.DB.prepare(
      "SELECT nickname FROM player_cache WHERE uid = ?"
    ).bind(uid).first();

    if (cached?.nickname) {
      return Response.json({
        success: true,
        nickname: cached.nickname,
        cached: true
      });
    }

    // API Key না থাকলে বাইরের API কল করবে না
    if (!env.FREEFIRE_API_KEY) {
      return Response.json(
        {
          success: false,
          message: "Player API এখনো চালু হয়নি"
        },
        { status: 503 }
      );
    }

    // বাংলাদেশি অ্যাকাউন্টের জন্য SG region
    const apiUrl = new URL(
      "https://developers.freefirecommunity.com/api/v1/info"
    );

    apiUrl.searchParams.set("region", "sg");
    apiUrl.searchParams.set("uid", uid);

    const apiResponse = await fetch(apiUrl.toString(), {
      headers: {
        "x-api-key": env.FREEFIRE_API_KEY,
        "User-Agent": "ZRXShopPlayerLookup/1.0",
        "Accept": "application/json"
      }
    });

    if (!apiResponse.ok) {
      return Response.json(
        {
          success: false,
          message: "Player API থেকে তথ্য পাওয়া যায়নি"
        },
        { status: 502 }
      );
    }

    const playerData = await apiResponse.json();
    const nickname = playerData?.basicInfo?.nickname;

    if (
      typeof nickname !== "string" ||
      !nickname.trim()
    ) {
      return Response.json(
        {
          success: false,
          message: "এই UID-এর Player Name পাওয়া যায়নি"
        },
        { status: 404 }
      );
    }

    // পাওয়া নাম ডেটাবেজে সংরক্ষণ
    await env.DB.prepare(`
      INSERT INTO player_cache (uid, nickname, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(uid) DO UPDATE SET
        nickname = excluded.nickname,
        updated_at = CURRENT_TIMESTAMP
    `).bind(uid, nickname.trim()).run();

    return Response.json({
      success: true,
      nickname: nickname.trim(),
      cached: false
    });

  } catch (error) {
    return Response.json(
      {
        success: false,
        message: "Server error"
      },
      { status: 500 }
    );
  }
}
