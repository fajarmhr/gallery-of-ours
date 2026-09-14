// Turns the Kepmendagri region list (db/wilayah.sql from github.com/cahyadsn/wilayah, MIT) into small JSON files
// the location picker loads on demand. Usage: node scripts/build-regions.mjs path/to/wilayah.sql
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

const source = process.argv[2];
if (!source) {
  console.error("Usage: node scripts/build-regions.mjs path/to/wilayah.sql");
  process.exit(1);
}

const out = path.join(process.cwd(), "public", "regions");
const sql = readFileSync(source, "utf8");
const rows = [...sql.matchAll(/\('([\d.]+)','((?:[^']|'')*)'\)/g)].map((m) => [m[1], m[2].replaceAll("''", "'").trim()]);

const provinces = [];
const perProvince = new Map();
const perRegency = new Map();

for (const [code, name] of rows) {
  const parts = code.split(".");
  if (parts.length === 1) {
    provinces.push([code, name]);
  } else if (parts.length === 2) {
    const file = perProvince.get(parts[0]) ?? { r: [], d: {} };
    file.r.push([code, name]);
    perProvince.set(parts[0], file);
  } else if (parts.length === 3) {
    const file = perProvince.get(parts[0]) ?? { r: [], d: {} };
    const regency = parts.slice(0, 2).join(".");
    (file.d[regency] ??= []).push([code, name]);
    perProvince.set(parts[0], file);
  } else if (parts.length === 4) {
    const regency = parts.slice(0, 2).join(".");
    const district = parts.slice(0, 3).join(".");
    const file = perRegency.get(regency) ?? {};
    (file[district] ??= []).push([code, name]);
    perRegency.set(regency, file);
  }
}

const byName = (a, b) => a[1].localeCompare(b[1], "id");
rmSync(out, { recursive: true, force: true });
mkdirSync(path.join(out, "p"), { recursive: true });
mkdirSync(path.join(out, "v"), { recursive: true });

writeFileSync(path.join(out, "provinces.json"), JSON.stringify(provinces.sort(byName)));
for (const [code, file] of perProvince) {
  file.r.sort(byName);
  for (const list of Object.values(file.d)) list.sort(byName);
  writeFileSync(path.join(out, "p", `${code}.json`), JSON.stringify(file));
}
for (const [code, file] of perRegency) {
  for (const list of Object.values(file)) list.sort(byName);
  writeFileSync(path.join(out, "v", `${code}.json`), JSON.stringify(file));
}
writeFileSync(
  path.join(out, "SOURCE.txt"),
  [
    "Kode dan data wilayah administrasi Indonesia (Kepmendagri 2025).",
    "Source: https://github.com/cahyadsn/wilayah (db/wilayah.sql)",
    "Copyright (c) 2025 cahya dsn. Released under the MIT License.",
    "",
  ].join("\n"),
);

const count = (depth) => rows.filter(([code]) => code.split(".").length === depth).length;
console.log(`provinces ${count(1)}, regencies ${count(2)}, districts ${count(3)}, villages ${count(4)}`);
console.log(provinces.map(([code, name]) => `${code} ${name}`).join("\n"));
