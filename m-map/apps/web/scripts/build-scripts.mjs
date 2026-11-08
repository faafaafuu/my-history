// Скрипты для рантайм-образа: standalone-сборка Next не тащит tsx, поэтому
// migrate и user-create собираются в самодостаточные .mjs.
import { build } from "esbuild";

await build({
  entryPoints: ["scripts/migrate.ts", "scripts/user-create.ts"],
  outdir: "dist/scripts",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // next/headers не нужен скриптам; users.ts его не импортирует.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});
