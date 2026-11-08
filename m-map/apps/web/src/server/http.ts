// Обёртка Route Handlers: единый формат ошибок `{ error }`, метрики, никаких
// тел запросов в логах (там здоровье и привычки).

import { ZodError, type ZodType } from "zod";
import { observeRequest } from "./metrics";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}

export const json = (data: unknown, init: ResponseInit = {}) => Response.json(data, init);

const MAX_BODY = 2 * 1024 * 1024;

export async function readJson<T>(req: Request, schema: ZodType<T>, limit = MAX_BODY): Promise<T> {
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > limit) throw new HttpError(413, "Слишком большой запрос.");
  const text = await req.text();
  if (text.length > limit) throw new HttpError(413, "Слишком большой запрос.");
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "Тело запроса — не JSON.");
  }
  return schema.parse(data);
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response> | Response;

/** `route("nodes.list", async (req) => …)` — имя идёт в метрики вместо пути с id. */
export function route<C = unknown>(name: string, handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    const started = performance.now();
    let status = 500;
    try {
      const res = await handler(req, ctx);
      status = res.status;
      return res;
    } catch (err) {
      if (err instanceof HttpError) {
        status = err.status;
        return json({ error: err.message }, { status, headers: err.headers });
      }
      if (err instanceof ZodError) {
        status = 400;
        return json({ error: "Неверные данные.", issues: err.issues.map((i) => ({ path: i.path, message: i.message })) }, { status });
      }
      // Только имя и тип ошибки: сообщение драйвера БД может содержать данные.
      console.error(`[${name}] ${err instanceof Error ? err.name : "Error"}`);
      return json({ error: "Внутренняя ошибка." }, { status });
    } finally {
      observeRequest(name, req.method, status, (performance.now() - started) / 1000);
    }
  };
}
