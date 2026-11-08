import client from "prom-client";

type Metrics = {
  registry: client.Registry;
  http: client.Histogram<"route" | "method" | "status">;
  llm: client.Histogram<"provider" | "prompt" | "outcome">;
};

const store = globalThis as unknown as { __mmapMetrics?: Metrics };

function create(): Metrics {
  const registry = new client.Registry();
  registry.setDefaultLabels({ app: "m-map" });
  client.collectDefaultMetrics({ register: registry });
  return {
    registry,
    http: new client.Histogram({
      name: "mmap_http_request_duration_seconds",
      help: "Длительность запросов к API",
      labelNames: ["route", "method", "status"],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
      registers: [registry],
    }),
    llm: new client.Histogram({
      name: "mmap_llm_request_duration_seconds",
      help: "Длительность запросов к LLM",
      labelNames: ["provider", "prompt", "outcome"],
      buckets: [0.5, 1, 2, 4, 6, 8, 10, 15, 30, 60, 120],
      registers: [registry],
    }),
  };
}

export function metrics(): Metrics {
  store.__mmapMetrics ??= create();
  return store.__mmapMetrics;
}

export function observeRequest(route: string, method: string, status: number, seconds: number) {
  metrics().http.observe({ route, method, status: String(status) }, seconds);
}
