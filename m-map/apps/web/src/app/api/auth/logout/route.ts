import { closeSession, sessionCookie, sessionTokenOf } from "@/server/auth/session";
import { json, route } from "@/server/http";

export const POST = route("auth.logout", async (req) => {
  await closeSession(sessionTokenOf(req));
  return json({ ok: true }, { headers: { "Set-Cookie": sessionCookie("", 0) } });
});
