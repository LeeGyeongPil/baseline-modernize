import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadData, resolveFeatureIds } from "../baseline/data.js";
import { RULES } from "../rules/index.js";
import { ROOT, runCli } from "./helpers.js";

const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as {
  devDependencies: Record<string, string>;
  dependencies: Record<string, string>;
};

test("data snapshot version equals the exact web-features devDependency", () => {
  const pinned = pkg.devDependencies["web-features"];
  assert.equal(pinned, "3.46.0");
  assert.match(pinned as string, /^\d+\.\d+\.\d+$/, "no range operator allowed");
  assert.equal(loadData().webFeaturesVersion, pinned);
});

test("runtime dependencies are pinned exactly", () => {
  for (const [name, range] of Object.entries(pkg.dependencies)) {
    assert.match(range, /^\d+\.\d+\.\d+$/, name);
  }
});

test("every rule replacement id resolves to a real feature", () => {
  const data = loadData();
  for (const rule of RULES) {
    const ids = rule.featureIds();
    assert.ok(ids.length > 0, rule.id);
    for (const id of ids) {
      const resolved = resolveFeatureIds(id, data);
      assert.ok(resolved.length > 0, rule.id + " -> " + id);
      for (const r of resolved) assert.equal(data.features[r]?.kind, "feature");
    }
  }
});

test("there are exactly 13 rules, sorted by id", () => {
  assert.equal(RULES.length, 13);
  const ids = RULES.map((r) => r.id);
  assert.deepEqual(ids, [...ids].sort());
});

function golden(name: string): string {
  return readFileSync(join(ROOT, "test", "golden", name), "utf8");
}

test("two runs give byte-identical JSON equal to the golden files", () => {
  for (const [target, file] of [
    ["widely", "legacy-app.widely.json"],
    ["2021", "legacy-app.2021.json"],
  ] as const) {
    const args = ["examples/legacy-app", "--format", "json", "--exit-zero", "--lang", "en", "--baseline", target];
    const a = runCli(args);
    const b = runCli(args);
    assert.equal(a.status, 0);
    assert.equal(a.stdout, b.stdout);
    assert.equal(a.stdout, golden(file), "update with: npm run build && node dist/cli.js examples/legacy-app --format json --exit-zero --lang en --baseline " + target + " > test/golden/" + file);
  }
});
