import { z } from "zod";
import { issueApiToken, verifyCredentials } from "@/server/auth/session";
import { json, readJson, route } from "@/server/http";
import { clientIp, limiter } from "@/server/rate-limit";

const Body = z.object({
  email: z.string().max(260),
  password: z.string().max(1000),
  label: z.string().trim().min(1).max(60).default("iOS"),
});

/** Вход приложения (iOS): вместо cookie — ключ `mm_…` для `Authorization: Bearer`. */
export const POST = route("auth.token", async (req) => {
  limiter("login").assert(clientIp(req), "Слишком много попыток. Подождите несколько минут.");
  const { email, password, label } = await readJson(req, Body, 4096);
  const user = await verifyCredentials(email, password);
  return json({ token: await issueApiToken(user.id, label), user });
});
