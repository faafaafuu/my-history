import { sql } from "drizzle-orm";
import { db, schema } from "../db";
import { HttpError } from "../http";
import { hashPassword, isEmail, MIN_PASSWORD } from "./password";

/** Создание пользователя — общее для CLI `user:create` и открытой регистрации. */
export async function createUser(email: string, password: string, name = "") {
  const mail = email.trim();
  if (!isEmail(mail)) throw new HttpError(400, "Проверьте почту.");
  if (password.length < MIN_PASSWORD) throw new HttpError(400, `Пароль — от ${MIN_PASSWORD} знаков.`);
  const [taken] = await db()
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = lower(${mail})`)
    .limit(1);
  if (taken) throw new HttpError(409, "Эта почта уже зарегистрирована.");
  const [user] = await db()
    .insert(schema.users)
    .values({ email: mail, name: name.trim() || mail.split("@")[0]!, pass: await hashPassword(password) })
    .returning({ id: schema.users.id, email: schema.users.email, name: schema.users.name });
  return user!;
}
