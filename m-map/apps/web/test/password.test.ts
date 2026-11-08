import { describe, expect, it } from "vitest";
import { checkPassword, DUMMY_HASH, hashPassword, isEmail, newApiToken, sha256 } from "@/server/auth/password";

describe("пароли", () => {
  it("хэш проверяется и не совпадает с другим паролем", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash).toMatch(/^scrypt\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(await checkPassword("correct horse battery", hash)).toBe(true);
    expect(await checkPassword("wrong horse battery", hash)).toBe(false);
  });
  it("соль случайная", async () => {
    expect(await hashPassword("same password")).not.toBe(await hashPassword("same password"));
  });
  it("пустышка и мусор не проходят", async () => {
    expect(await checkPassword("anything", DUMMY_HASH)).toBe(false);
    expect(await checkPassword("anything", "plain")).toBe(false);
  });
});

describe("токены и почта", () => {
  it("ключ приложения с префиксом mm_", () => {
    expect(newApiToken()).toMatch(/^mm_[A-Za-z0-9_-]{32}$/);
    expect(sha256("x")).toHaveLength(64);
  });
  it("простая проверка почты", () => {
    expect(isEmail("me@example.com")).toBe(true);
    expect(isEmail("not an email")).toBe(false);
  });
});
