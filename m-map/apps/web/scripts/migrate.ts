// Миграции при старте контейнера: `node dist/scripts/migrate.mjs`.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL не задан");
  process.exit(1);
}
const folder = process.env.MIGRATIONS_DIR ?? new URL("../drizzle", import.meta.url).pathname;

// Postgres в compose может ещё подниматься: ждём до 60 с.
const sql = postgres(url, { max: 1, onnotice: () => {} });
for (let attempt = 1; ; attempt++) {
  try {
    await sql`select 1`;
    break;
  } catch (err) {
    if (attempt >= 30) throw err;
    await new Promise((r) => setTimeout(r, 2000));
  }
}
await migrate(drizzle(sql), { migrationsFolder: folder });
console.log("migrations: ok");
await sql.end();
