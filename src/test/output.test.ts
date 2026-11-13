import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli, tempDir, writeFiles } from "./helpers.js";

interface Json {
  webFeatures: string;
  baseline: string;
  findings: Array<{ rule: string; line: number; confidence: string; fingerprint: string }>;
  silenced: unknown[];
  skipped: Array<{ path: string; reason: string }>;
  summary: Record<string, number>;
}

test("JSON output has the documented top-level keys", () => {
  const r = runCli(["examples/legacy-app", "--format", "json", "--exit-zero", "--lang", "en"]);
  const j = JSON.parse(r.stdout) as Json;
  assert.equal(j.webFeatures, "3.46.0");
  assert.equal(j.baseline, "widely");
  assert.ok(Array.isArray(j.findings) && j.findings.length > 0);
  assert.ok(Array.isArray(j.silenced) && j.silenced.length === 1);
  assert.ok(Array.isArray(j.skipped));
  assert.equal(j.summary.findings, j.findings.length);
  assert.equal(j.summary.new, j.findings.length);
  assert.equal(j.summary.silenced, 1);
});

interface Sarif {
  version: string;
  $schema: string;
  runs: Array<{
    tool: { driver: { name: string; rules: Array<{ id: string; helpUri: string }> } };
    results: Array<{
      ruleId: string;
      level: string;
      locations: Array<{ physicalLocation: { region: { startLine: number } } }>;
      partialFingerprints: Record<string, string>;
    }>;
  }>;
}

test("SARIF output follows 2.1.0 with 13 rules and mapped levels", () => {
  const r = runCli(["examples/legacy-app", "--format", "sarif", "--exit-zero", "--lang", "en"]);
  const s = JSON.parse(r.stdout) as Sarif;
  assert.equal(s.version, "2.1.0");
  assert.match(s.$schema, /sarif-2\.1\.0/);
  const run = s.runs[0];
  assert.ok(run);
  assert.equal(run.tool.driver.name, "baseline-modernize");
  assert.equal(run.tool.driver.rules.length, 13);
  for (const rule of run.tool.driver.rules) {
    assert.match(rule.helpUri, /^https:\/\/web-platform-dx\.github\.io\/web-features-explorer\//);
  }
  assert.ok(run.results.length > 0);
  const suspect = new Set(["scroll-listener", "owl-spacing", "js-accordion"]);
  for (const res of run.results) {
    assert.equal(res.level, suspect.has(res.ruleId) ? "warning" : "error", res.ruleId);
    assert.ok((res.locations[0]?.physicalLocation.region.startLine ?? 0) >= 1);
    assert.match(res.partialFingerprints["baselineModernize/v1"] ?? "", /^[0-9a-f]{16}$/);
  }
  assert.ok(run.results.some((x) => x.level === "warning"));
});

test("text output ends with the data version and lists skipped files", () => {
  const dir = tempDir();
  writeFiles(dir, { "ok.js": "new XMLHttpRequest();\n", "broken.js": "const = ;\n", "node_modules/x/a.js": "new XMLHttpRequest();\n", "lib.min.js": "x" });
  const r = runCli([".", "--lang", "en"], { cwd: dir });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /web-features 3\.46\.0 · baseline: widely/);
  assert.match(r.stdout, /Skipped:/);
  assert.match(r.stdout, /broken\.js \(parse error\)/);
  assert.match(r.stdout, /node_modules \(default skip list\)/);
  assert.match(r.stdout, /lib\.min\.js \(minified file\)/);
  assert.match(r.stdout, /ok\.js:1:1/);
});

test("--confidence certain hides suspect findings", () => {
  const all = JSON.parse(runCli(["examples/legacy-app", "--format", "json", "--exit-zero"]).stdout) as Json;
  const certain = JSON.parse(runCli(["examples/legacy-app", "--format", "json", "--exit-zero", "--confidence", "certain"]).stdout) as Json;
  assert.ok(all.findings.some((f) => f.confidence === "suspect"));
  assert.ok(certain.findings.every((f) => f.confidence === "certain"));
});

test("--exclude skips a path prefix and records it", () => {
  const r = runCli(["examples/legacy-app", "--exclude", "examples/legacy-app/style", "--format", "json", "--exit-zero"]);
  const j = JSON.parse(r.stdout) as Json;
  assert.ok(j.findings.every((f) => !f.rule.includes("padding")));
  assert.deepEqual(j.skipped, [{ path: "examples/legacy-app/style.css", reason: "excluded" }]);
});
