import { test } from "node:test";
import assert from "node:assert/strict";
import { MESSAGES, resolveLang, t } from "../i18n/index.js";
import { RULES } from "../rules/index.js";
import { runCli } from "./helpers.js";

test("en and ko dictionaries have identical key sets", () => {
  assert.deepEqual(Object.keys(MESSAGES.ko).sort(), Object.keys(MESSAGES.en).sort());
});

test("no message is empty and placeholders match between languages", () => {
  const placeholders = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1] as string).sort();
  for (const key of Object.keys(MESSAGES.en) as Array<keyof typeof MESSAGES.en>) {
    assert.ok(MESSAGES.en[key].length > 0, key);
    assert.ok(MESSAGES.ko[key].length > 0, key);
    assert.deepEqual(placeholders(MESSAGES.ko[key]), placeholders(MESSAGES.en[key]), key);
  }
});

test("every rule has a title and a message in both languages", () => {
  for (const rule of RULES) {
    for (const lang of ["en", "ko"] as const) {
      assert.ok(MESSAGES[lang]["rule." + rule.id + ".title" as keyof typeof MESSAGES.en], rule.id);
      assert.ok(MESSAGES[lang]["rule." + rule.id + ".message" as keyof typeof MESSAGES.en], rule.id);
    }
  }
});

test("resolveLang order: flag > tool env > LC_ALL > LC_MESSAGES > LANG, default English", () => {
  assert.equal(resolveLang("ko", { LANG: "en_US.UTF-8" }), "ko");
  assert.equal(resolveLang("en", { BASELINE_MODERNIZE_LANG: "ko" }), "en");
  assert.equal(resolveLang(undefined, { BASELINE_MODERNIZE_LANG: "ko", LANG: "en_US.UTF-8" }), "ko");
  assert.equal(resolveLang(undefined, { BASELINE_MODERNIZE_LANG: "en", LC_ALL: "ko_KR.UTF-8" }), "en");
  assert.equal(resolveLang(undefined, { LC_ALL: "ko_KR.UTF-8", LANG: "en_US.UTF-8" }), "ko");
  assert.equal(resolveLang(undefined, { LC_MESSAGES: "ko_KR.UTF-8", LANG: "en_US.UTF-8" }), "ko");
  assert.equal(resolveLang(undefined, { LANG: "ko_KR.UTF-8" }), "ko");
  assert.equal(resolveLang(undefined, { LANG: "fr_FR.UTF-8" }), "en");
  assert.equal(resolveLang(undefined, {}), "en");
});

test("t() substitutes placeholders and leaves unknown ones", () => {
  assert.equal(t("en", "err.pathNotFound", { path: "x" }).startsWith("Path not found: x."), true);
  assert.match(t("ko", "err.pathNotFound", { path: "x" }), /^경로를 찾을 수 없습니다: x\./);
});

test("--lang ko --help shows Korean labels; --lang en --help shows English labels", () => {
  const ko = runCli(["--lang", "ko", "--help"]);
  assert.equal(ko.status, 0);
  assert.match(ko.stdout, /사용법/);
  assert.match(ko.stdout, /옵션/);
  assert.doesNotMatch(ko.stdout, /Usage:/);
  const en = runCli(["--lang", "en", "--help"]);
  assert.match(en.stdout, /Usage/);
  assert.match(en.stdout, /Options/);
  assert.doesNotMatch(en.stdout, /사용법/);
});

test("environment variables pick the language and --lang overrides them", () => {
  assert.match(runCli(["--help"], { env: { BASELINE_MODERNIZE_LANG: "ko" } }).stdout, /사용법/);
  assert.match(runCli(["--help"], { env: { LANG: "ko_KR.UTF-8" } }).stdout, /사용법/);
  assert.match(runCli(["--help"], { env: { LANG: "fr_FR.UTF-8" } }).stdout, /Usage/);
  assert.match(runCli(["--help", "--lang", "en"], { env: { BASELINE_MODERNIZE_LANG: "ko" } }).stdout, /Usage/);
});

test("rule messages, summary line and error messages follow the language", () => {
  const ko = runCli(["examples/legacy-app", "--exit-zero", "--lang", "ko"]);
  assert.match(ko.stdout, /XMLHttpRequest 는 낡은 요청 API/);
  assert.match(ko.stdout, /보고 13건/);
  const en = runCli(["examples/legacy-app", "--exit-zero", "--lang", "en"]);
  assert.match(en.stdout, /XMLHttpRequest is the legacy request API/);
  assert.match(en.stdout, /13 findings/);
  assert.match(runCli(["nope", "--lang", "ko"]).stderr, /경로를 찾을 수 없습니다/);
  assert.match(runCli(["nope", "--lang", "en"]).stderr, /Path not found: nope/);
});

test("option errors are localised too", () => {
  const unknown = runCli(["--bogus", "--lang", "ko"]);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /알 수 없는 옵션 --bogus/);
  const missing = runCli(["examples/legacy-app", "--baseline", "--lang", "en"]);
  assert.equal(missing.status, 2);
  const badLang = runCli(["--lang", "fr"]);
  assert.equal(badLang.status, 2);
  assert.match(badLang.stderr, /Invalid language "fr"/);
});

test("displayWidth counts the ellipsis as one column and Hangul as two", async () => {
  const { displayWidth } = await import("../i18n/index.js");
  assert.equal(displayWidth("a, …"), 4);
  assert.equal(displayWidth("가나"), 4);
});
