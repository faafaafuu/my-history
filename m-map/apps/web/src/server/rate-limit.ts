// Скользящее окно в памяти процесса. Инстанс web один (docker compose), поэтому
// общего хранилища не нужно; при масштабировании — перенести в Postgres/Redis.

import { HttpError } from "./http";

export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private now: () => number = Date.now,
  ) {}

  /** true — запрос пропускаем; false — лимит исчерпан. */
  take(key: string): boolean {
    const t = this.now();
    const list = (this.hits.get(key) ?? []).filter((at) => t - at < this.windowMs);
    if (list.length >= this.limit) {
      this.hits.set(key, list);
      return false;
    }
    list.push(t);
    this.hits.set(key, list);
    if (this.hits.size > 10_000) this.sweep(t);
    return true;
  }

  /** Секунд до освобождения места. */
  retryAfter(key: string): number {
    const list = this.hits.get(key) ?? [];
    const oldest = list[0];
    return oldest === undefined ? 0 : Math.max(1, Math.ceil((oldest + this.windowMs - this.now()) / 1000));
  }

  private sweep(t: number) {
    for (const [key, list] of this.hits) if (!list.some((at) => t - at < this.windowMs)) this.hits.delete(key);
  }

  assert(key: string, message = "Слишком много запросов. Подождите немного.") {
    if (!this.take(key)) throw new HttpError(429, message, { "Retry-After": String(this.retryAfter(key)) });
  }
}

const store = globalThis as unknown as { __mmapLimits?: Record<string, RateLimiter> };

/** Именованные лимитеры: `login` — по IP, `ai` — по пользователю. */
export function limiter(name: "login" | "ai"): RateLimiter {
  store.__mmapLimits ??= {
    login: new RateLimiter(10, 10 * 60_000),
    ai: new RateLimiter(Number(process.env.AI_RATE_LIMIT ?? 30), 60 * 60_000),
  };
  return store.__mmapLimits[name]!;
}

/** IP клиента: за nginx — из X-Real-IP (nginx перезаписывает его сам). */
export function clientIp(req: Request): string {
  return req.headers.get("x-real-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}
