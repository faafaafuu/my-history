import { env } from "@/server/env";
import { metrics } from "@/server/metrics";

export const dynamic = "force-dynamic";

/** Prometheus. Снаружи закрыт nginx'ом; токен — второй замок, если задан. */
export async function GET(req: Request) {
  const token = env().METRICS_TOKEN;
  if (token && req.headers.get("authorization") !== `Bearer ${token}`) return new Response("forbidden", { status: 403 });
  const { registry } = metrics();
  return new Response(await registry.metrics(), { headers: { "Content-Type": registry.contentType } });
}
