// Создать пользователя (регистрация закрыта):
//   docker compose exec web node dist/scripts/user-create.mjs you@example.com
// Пароль спрашивается без эха; для автоматизации — переменная USER_PASSWORD.
import { createInterface } from "node:readline";
import { createUser } from "../src/server/auth/users";
import { rawSql } from "../src/server/db";

async function askHidden(question: string): Promise<string> {
  if (!process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin });
    for await (const line of rl) return line;
    return "";
  }
  process.stdout.write(question);
  return new Promise((resolve) => {
    const stdin = process.stdin;
    let value = "";
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (ch: string) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        process.stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        process.exit(130);
      } else if (ch === "\u007f") {
        value = value.slice(0, -1);
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const [email, name = ""] = process.argv.slice(2);
if (!email) {
  console.error("Использование: user-create <email> [имя]");
  process.exit(1);
}
const password = process.env.USER_PASSWORD ?? (await askHidden("Пароль (от 10 знаков): "));
try {
  const user = await createUser(email, password, name);
  console.log(`Создан пользователь ${user.email} (${user.id})`);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await rawSql().end();
}
