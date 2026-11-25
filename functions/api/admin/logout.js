
export async function onRequestPost() {
  return Response.json(
    {
      success: true,
      message: "Logged out"
    },
    {
      headers: {
        "Set-Cookie": "zrx_admin_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0",
        "Cache-Control": "no-store"
      }
    }
  );
}
