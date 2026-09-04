import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
const pkg = JSON.parse(await readFile("package.json", "utf8"));

assert.equal(manifest.id, "rowbase");
assert.equal(manifest.name, "Rowbase");
assert.equal(manifest.isDesktopOnly, false);
assert.equal(pkg.name, "rowbase");
assert.equal(pkg.main, "main.js");
