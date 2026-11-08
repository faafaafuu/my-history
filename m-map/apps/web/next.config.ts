import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";

const config: NextConfig = {
  output: "standalone",
  // Монорепо: трассировка файлов для standalone идёт от корня, иначе workspace-пакеты не попадут в образ.
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  transpilePackages: ["@m-map/core"],
  poweredByHeader: false,
  reactStrictMode: true,
};

export default config;
