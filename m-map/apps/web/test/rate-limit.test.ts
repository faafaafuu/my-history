import { describe, expect, it } from "vitest";
import { RateLimiter } from "@/server/rate-limit";

describe("RateLimiter", () => {
  it("пропускает limit запросов в окне и освобождает после", () => {
    let t = 0;
    const rl = new RateLimiter(3, 1000, () => t);
    expect([rl.take("a"), rl.take("a"), rl.take("a"), rl.take("a")]).toEqual([true, true, true, false]);
    expect(rl.take("b")).toBe(true);
    expect(rl.retryAfter("a")).toBe(1);
    t = 1001;
    expect(rl.take("a")).toBe(true);
  });
});
