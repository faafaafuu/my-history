import { z } from "zod";
import { createUser } from "@/server/auth/users";
import { openSession, sessionCookie } from "@/server/auth/session";
import { env } from "@/server/env";
import { HttpError, json, readJson, route } from "@/server/http";
import { clientIp, limiter } from "@/server/rate-limit";

const Body = z.object({ email: z.string().max(260), password: z.string().max(1000), name: z.string().max(60).default("") });

/** Закрыта, пока ALLOW_SIGNUP=false. Схема уже мультипользовательская. */
export const POST = route("auth.register", async (req) => {
  if (!env().ALLOW_SIGNUP) throw new HttpError(403, "Регистрация закрыта.");
  limiter("login").assert(clientIp(req), "Слишком много попыток. Подождите несколько минут.");
  const { email, password, name } = await readJson(req, Body, 4096);
  const user = await createUser(email, password, name);
  return json({ user }, { status: 201, headers: { "Set-Cookie": sessionCookie(await openSession(user.id)) } });
});
