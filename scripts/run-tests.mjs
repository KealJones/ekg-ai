import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const experimental = new Set([
  "v0.4-phase0.test.mjs",
  "v0.5-phase0.test.mjs",
]);
const mode = process.argv[2] ?? "fast";
const all = readdirSync(new URL("../tests/", import.meta.url))
  .filter(name => name.endsWith(".test.mjs"))
  .sort();

let selected;
switch (mode) {
  case "fast":
    selected = all.filter(name => !experimental.has(name));
    break;
  case "experiments":
    selected = all.filter(name => experimental.has(name));
    break;
  case "all":
    selected = all;
    break;
  default:
    throw new Error(`Unknown test mode: ${mode}`);
}

const files = selected.map(name => new URL(`../tests/${name}`, import.meta.url).pathname);
const result = spawnSync(process.execPath, ["--test", ...files], { stdio: "inherit" });
process.exit(result.status ?? 1);
