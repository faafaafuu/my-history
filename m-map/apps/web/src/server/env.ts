import { z } from "zod";

const flag = z
  .enum(["true", "false", "1", "0", ""])
  .default("false")
  .transform((v) => v === "true" || v === "1");

const Env = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1).default("postgres://mmap:mmap@localhost:5432/mmap"),
  /** Регистрация закрыта: пользователь создаётся командой `user:create`. */
  ALLOW_SIGNUP: flag,
  SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /** Secure-cookie. По умолчанию — в production. */
  COOKIE_SECURE: z.enum(["true", "false", ""]).default(""),
  /** Если задан, /metrics требует `Authorization: Bearer <METRICS_TOKEN>`. */
  METRICS_TOKEN: z.string().default(""),
});

export type Env = z.infer<typeof Env>;

let cached: Env | undefined;

/** Окружение читается лениво: `next build` проходит без DATABASE_URL. */
export function env(): Env {
  cached ??= Env.parse(process.env);
  return cached;
}

export const cookieSecure = () => {
  const e = env();
  return e.COOKIE_SECURE === "" ? e.NODE_ENV === "production" : e.COOKIE_SECURE === "true";
};
