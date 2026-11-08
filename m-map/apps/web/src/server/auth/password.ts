// Пароли и токены — по схеме asis (platform/server/server.mjs): scrypt
// N=16384, r=8, p=1, соль 16 байт, ключ 64 байта; токены хранятся sha256.

import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, type ScryptOptions } from "node:crypto";

const PARAMS: ScryptOptions = { N: 16384, r: 8, p: 1 };
const KEY_LEN = 64;

const scrypt = (password: string, salt: Buffer, len: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password, salt, len, PARAMS, (err, key) => (err ? reject(err) : resolve(key))),
  );

export const MIN_PASSWORD = 10;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** Хэш-пустышка: проверка идёт и для несуществующей почты, время не выдаёт наличие аккаунта. */
export const DUMMY_HASH = `scrypt$${"A".repeat(22)}==$${"A".repeat(86)}==`;

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [kind, salt, key] = stored.split("$");
  if (kind !== "scrypt" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64");
  if (expected.length === 0) return false;
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length);
  return timingSafeEqual(expected, actual);
}

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export const newSessionToken = () => randomBytes(32).toString("base64url");

/** Ключ приложения: префикс виден в логах и в коде, сам ключ — нет. */
export const newApiToken = () => `mm_${randomBytes(24).toString("base64url")}`;

export const isEmail = (value: string) => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/.test(value);
