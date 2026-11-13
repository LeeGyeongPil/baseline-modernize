import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTarget } from "../baseline/gate.js";
import { scan } from "../scan.js";
import { ROOT } from "./helpers.js";

const run = (baseline: string) =>
  scan({ paths: ["examples/legacy-app"], cwd: ROOT, target: parseTarget(baseline), lang: "en" });

test("widely: eight rules reported, js-accordion silenced because details-name is only Newly", async () => {
  const r = await run("widely");
  const reported = new Set(r.findings.map((f) => f.rule));
  for (const rule of ["json-deep-clone", "xhr", "hasown-call", "array-last-index", "div-dialog", "img-data-src", "padding-hack-ratio", "unneeded-prefix"]) {
    assert.ok(reported.has(rule), rule);
  }
  assert.ok(!reported.has("js-accordion"));
  const accordion = r.silenced.find((s) => s.rule === "js-accordion");
  assert.equal(accordion?.featureId, "details-name");
  assert.equal(accordion?.reason.baseline, "low");
});

test("2021: newer replacements are silenced, older ones remain", async () => {
  const r = await run("2021");
  const suggested = new Set(r.findings.map((f) => f.featureId));
  for (const id of ["fetch", "intersection-observer", "aspect-ratio", "flexbox-gap"]) assert.ok(suggested.has(id), id);
  const silenced = new Set(r.silenced.map((s) => s.featureId));
  for (const id of ["structured-clone", "object-hasown", "array-at", "dialog", "appearance", "loading-lazy"]) {
    assert.ok(silenced.has(id), id + " should be silenced");
    assert.ok(!suggested.has(id), id + " should not be suggested");
  }
});

test("findings are sorted by file, line, column", async () => {
  const r = await run("newly");
  const keys = r.findings.map((f) => [f.file, f.line, f.column] as const);
  const sorted = [...keys].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] - b[1] || a[2] - b[2]));
  assert.deepEqual(keys, sorted);
});
