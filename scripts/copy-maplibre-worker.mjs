// Turbopack emits maplibre-gl's worker under a hashed name but leaves its `./maplibre-gl-shared.mjs` import as-is,
// so the worker fails to load and maps render without tiles. Serve both files from public/maplibre/ instead
// (see MAPLIBRE_WORKER_URL). Runs before dev/build so the copy always matches the installed version.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dist = join(dirname(createRequire(import.meta.url).resolve("maplibre-gl/package.json")), "dist");
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "maplibre");

mkdirSync(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, file), join(out, file));
}
