import { z } from "zod";
import { openSession, sessionCookie, verifyCredentials } from "@/server/auth/session";
import { json, readJson, route } from "@/server/http";
import { clientIp, limiter } from "@/server/rate-limit";

const Body = z.object({ email: z.string().max(260), password: z.string().max(1000) });

/** Вход браузера: ставит HttpOnly-cookie сессии. */
export const POST = route("auth.login", async (req) => {
  limiter("login").assert(clientIp(req), "Слишком много попыток. Подождите несколько минут.");
  const { email, password } = await readJson(req, Body, 4096);
  const user = await verifyCredentials(email, password);
  const token = await openSession(user.id);
  return json({ user }, { headers: { "Set-Cookie": sessionCookie(token) } });
});
