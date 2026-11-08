import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

const store = globalThis as unknown as { __mmapDb?: { db: Db; sql: postgres.Sql } };

function connect() {
  // Логи запросов выключены намеренно: в параметрах — содержимое узлов.
  const sql = postgres(env().DATABASE_URL, { max: 10, idle_timeout: 30, onnotice: () => {} });
  return { sql, db: drizzle(sql, { schema }) };
}

/** Один пул на процесс; в dev переживает HMR. */
export function db(): Db {
  store.__mmapDb ??= connect();
  return store.__mmapDb.db;
}

export function rawSql(): postgres.Sql {
  store.__mmapDb ??= connect();
  return store.__mmapDb.sql;
}

export { schema };
