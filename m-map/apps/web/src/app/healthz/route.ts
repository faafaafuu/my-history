import { rawSql } from "@/server/db";

export const dynamic = "force-dynamic";

/** Живость для Docker и nginx: процесс жив и БД отвечает. */
export async function GET() {
  try {
    await rawSql()`select 1`;
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "db_unavailable" }, { status: 503 });
  }
}
