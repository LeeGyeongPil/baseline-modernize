import { chmodSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { runCli, tempDir, writeFiles } from "./helpers.js";

test("scanning examples/legacy-app exits 1 and prints the data version", () => {
  const r = runCli(["examples/legacy-app"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /web-features 3\.46\.0/);
});

test("--exit-zero exits 0 even with findings", () => {
  const r = runCli(["examples/legacy-app", "--exit-zero"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /json-deep-clone/);
});

test("a missing path exits 2", () => {
  const r = runCli(["does-not-exist"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Path not found: does-not-exist/);
});

test("a clean folder exits 0", () => {
  const dir = tempDir();
  writeFiles(dir, { "a.js": "export const x = structuredClone(y);\n" });
  const r = runCli([".", "--lang", "en"], { cwd: dir });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /No legacy patterns found\./);
});

test("a syntax-error file is skipped and the rest is still scanned", () => {
  const dir = tempDir();
  writeFiles(dir, { "bad.js": "function (", "bad.css": ".a { color: red;\n.b {", "good.js": "new XMLHttpRequest();\n" });
  const r = runCli([".", "--format", "json"], { cwd: dir });
  assert.equal(r.status, 1);
  const j = JSON.parse(r.stdout) as { skipped: Array<{ path: string; reason: string }>; findings: Array<{ file: string }> };
  assert.deepEqual(
    j.skipped.map((s) => s.path + ":" + s.reason),
    ["bad.css:parse-error", "bad.js:parse-error"],
  );
  assert.deepEqual(j.findings.map((f) => f.file), ["good.js"]);
});

test("--explain shows the silenced js-accordion with its reason", () => {
  const r = runCli(["examples/legacy-app", "--explain", "--exit-zero", "--lang", "en"]);
  assert.match(r.stdout, /Silenced by the baseline target:/);
  assert.match(r.stdout, /js-accordion\s+details-name: baseline=low/);
});

test("--explain with --baseline 2021 explains the date", () => {
  const r = runCli(["examples/legacy-app", "--baseline", "2021", "--explain", "--exit-zero", "--lang", "en"]);
  assert.match(r.stdout, /dialog: became Newly available on 2022-03-14, after 2021/);
});

test("rules lists 13 rules and exits 0", () => {
  const r = runCli(["rules", "--baseline", "widely"]);
  assert.equal(r.status, 0);
  const ids = r.stdout.split("\n").filter((l) => /^[a-z]+(-[a-z]+)+ /.test(l));
  assert.equal(ids.length, 13);
  assert.match(r.stdout, /js-accordion\s+JSX\/HTML\s+details-name\s+newly\s+silenced/);
  assert.match(r.stdout, /xhr\s+JS\/TS\s+fetch\s+widely\s+pass/);
});

test("--version prints tool and data versions", () => {
  const r = runCli(["--version"]);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /baseline-modernize \d+\.\d+\.\d+ \(web-features 3\.46\.0\)/);
});

test("an explicit file with an unsupported extension is reported as skipped", () => {
  const dir = tempDir();
  writeFiles(dir, { "notes.txt": "new XMLHttpRequest();" });
  const r = runCli(["notes.txt", "--lang", "en"], { cwd: dir });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /notes\.txt \(unsupported file type\)/);
});

test("invalid --format and --confidence exit 2", () => {
  assert.equal(runCli(["examples/legacy-app", "--format", "xml"]).status, 2);
  assert.equal(runCli(["examples/legacy-app", "--confidence", "maybe"]).status, 2);
});

test("all findings known: says no NEW patterns instead of none (en and ko)", () => {
  const dir = tempDir();
  writeFiles(dir, { "a.js": "new XMLHttpRequest();\n" });
  assert.equal(runCli([".", "--write-known", "k.json"], { cwd: dir }).status, 0);
  const en = runCli([".", "--known", "k.json", "--lang", "en"], { cwd: dir });
  assert.equal(en.status, 0);
  assert.match(en.stdout, /No new legacy patterns \(1 known\)\./);
  assert.doesNotMatch(en.stdout, /No legacy patterns found/);
  assert.match(en.stdout, /1 finding \(0 new, 1 known\).*1 file scanned/);
  const ko = runCli([".", "--known", "k.json", "--lang", "ko"], { cwd: dir });
  assert.match(ko.stdout, /새 낡은 패턴이 없습니다\(기존 1건\)\./);
});

test("plural summary stays plural for several files (en)", () => {
  const dir = tempDir();
  writeFiles(dir, { "a.js": "new XMLHttpRequest();\n", "b.js": "x;\n" });
  const r = runCli([".", "--lang", "en"], { cwd: dir });
  assert.match(r.stdout, /1 finding \(1 new, 0 known\).*2 files scanned/);
});

test("an unreadable subfolder is skipped with a warning and the scan continues", () => {
  const dir = tempDir();
  writeFiles(dir, { "good.js": "new XMLHttpRequest();\n", "locked/x.js": "new XMLHttpRequest();\n" });
  const locked = join(dir, "locked");
  chmodSync(locked, 0o000);
  try {
    const r = runCli([".", "--format", "json"], { cwd: dir });
    assert.equal(r.status, 1);
    const j = JSON.parse(r.stdout) as { skipped: Array<{ path: string; reason: string }>; findings: Array<{ file: string }> };
    assert.ok(j.findings.some((f) => f.file === "good.js"));
    let readable = true; // running as root: chmod 000 does not block reading
    try {
      readdirSync(locked);
    } catch {
      readable = false;
    }
    if (!readable) {
      assert.deepEqual(j.skipped, [{ path: "locked", reason: "unreadable" }]);
      const en = runCli([".", "--lang", "en"], { cwd: dir });
      assert.match(en.stdout, /locked \(unreadable folder/);
      const ko = runCli([".", "--lang", "ko"], { cwd: dir });
      assert.match(ko.stdout, /locked \(읽을 수 없는 폴더/);
    }
  } finally {
    chmodSync(locked, 0o755);
  }
});
