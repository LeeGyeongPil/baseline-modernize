import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { runCli, tempDir, writeFiles } from "./helpers.js";

interface Json {
  findings: Array<{ rule: string; known: boolean; line: number }>;
  summary: { new: number; known: number };
}

const files = {
  "src/a.js": "const a = JSON.parse(JSON.stringify(x));\nconst r = new XMLHttpRequest();\n",
  "src/b.css": ".v { padding-top: 56.25%; }\n",
};

function scanKnown(dir: string): { status: number | null; json: Json } {
  const r = runCli(["src", "--known", "known.json", "--format", "json"], { cwd: dir });
  return { status: r.status, json: JSON.parse(r.stdout) as Json };
}

test("--write-known then --known gives 0 new findings and exit 0", () => {
  const dir = tempDir();
  writeFiles(dir, files);
  const w = runCli(["src", "--write-known", "known.json", "--lang", "en"], { cwd: dir });
  assert.equal(w.status, 0);
  assert.match(w.stdout, /Wrote 3 entries to known\.json/);
  const { status, json } = scanKnown(dir);
  assert.equal(status, 0);
  assert.equal(json.summary.new, 0);
  assert.equal(json.summary.known, 3);
  assert.ok(json.findings.every((f) => f.known));
});

test("inserting blank lines at the top keeps every finding known", () => {
  const dir = tempDir();
  writeFiles(dir, files);
  runCli(["src", "--write-known", "known.json"], { cwd: dir });
  writeFileSync(join(dir, "src/a.js"), "\n\n\n" + files["src/a.js"]);
  const { status, json } = scanKnown(dir);
  assert.equal(status, 0);
  assert.equal(json.summary.new, 0);
  assert.equal(json.findings[0]?.line, 4);
});

test("one new legacy line is exactly one new finding and exit 1", () => {
  const dir = tempDir();
  writeFiles(dir, files);
  runCli(["src", "--write-known", "known.json"], { cwd: dir });
  writeFileSync(join(dir, "src/a.js"), files["src/a.js"] + "const again = new XMLHttpRequest();\n");
  const { status, json } = scanKnown(dir);
  assert.equal(status, 1);
  assert.equal(json.summary.new, 1);
  assert.equal(json.summary.known, 3);
});

test("a duplicated identical line counts as one new finding", () => {
  const dir = tempDir();
  writeFiles(dir, files);
  runCli(["src", "--write-known", "known.json"], { cwd: dir });
  writeFileSync(join(dir, "src/a.js"), files["src/a.js"] + "const r = new XMLHttpRequest();\n");
  const { json } = scanKnown(dir);
  assert.equal(json.summary.new, 1);
});

test("the known file is deterministic JSON", () => {
  const dir = tempDir();
  writeFiles(dir, files);
  runCli(["src", "--write-known", "known.json"], { cwd: dir });
  const first = readFileSync(join(dir, "known.json"), "utf8");
  runCli(["src", "--write-known", "known.json"], { cwd: dir });
  assert.equal(readFileSync(join(dir, "known.json"), "utf8"), first);
  assert.equal((JSON.parse(first) as { version: number }).version, 1);
});

test("a missing or foreign known file exits 2 with guidance", () => {
  const dir = tempDir();
  writeFiles(dir, { ...files, "other.json": "{\"a\":1}" });
  const missing = runCli(["src", "--known", "nope.json", "--lang", "en"], { cwd: dir });
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /--write-known/);
  const foreign = runCli(["src", "--known", "other.json", "--lang", "en"], { cwd: dir });
  assert.equal(foreign.status, 2);
  assert.match(foreign.stderr, /not a baseline-modernize known-findings file/);
});

test("SARIF marks findings as new or unchanged when a known file is used", () => {
  const dir = tempDir();
  writeFiles(dir, files);
  runCli(["src", "--write-known", "known.json"], { cwd: dir });
  writeFileSync(join(dir, "src/a.js"), files["src/a.js"] + "new XMLHttpRequest();\n");
  const r = runCli(["src", "--known", "known.json", "--format", "sarif"], { cwd: dir });
  const sarif = JSON.parse(r.stdout) as { runs: Array<{ results: Array<{ baselineState: string }> }> };
  const states = (sarif.runs[0]?.results ?? []).map((x) => x.baselineState).sort();
  assert.deepEqual(states, ["new", "unchanged", "unchanged", "unchanged"]);
});
