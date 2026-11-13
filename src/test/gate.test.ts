import { test } from "node:test";
import assert from "node:assert/strict";
import type { BaselineData } from "../baseline/data.js";
import { evaluate, InvalidTargetError, parseTarget, stripRangePrefix } from "../baseline/gate.js";
import { runCli } from "./helpers.js";

// A tiny hand-made dataset so every case is explicit and independent of the real snapshot.
const data: BaselineData = {
  webFeaturesVersion: "test",
  features: {
    old: { kind: "feature", baseline: "high", low: "2016-05-01", high: "2018-11-01" },
    recent: { kind: "feature", baseline: "high", low: "2022-03-14", high: "2024-09-14" },
    fresh: { kind: "feature", baseline: "low", low: "2024-09-03" },
    limited: { kind: "feature", baseline: false },
    ranged: { kind: "feature", baseline: "high", low: "≤2018-01-01", high: "≤2020-07-01" },
    moved: { kind: "moved", redirects: ["recent"] },
    chain: { kind: "moved", redirects: ["moved"] },
    split: { kind: "split", redirects: ["old", "fresh"] },
    loop: { kind: "moved", redirects: ["loop"] },
  },
};

test("widely passes only baseline high", () => {
  const t = parseTarget("widely");
  assert.equal(evaluate("old", t, data).pass, true);
  assert.equal(evaluate("fresh", t, data).pass, false);
  assert.equal(evaluate("limited", t, data).pass, false);
});

test("newly passes high and low but not limited", () => {
  const t = parseTarget("newly");
  assert.equal(evaluate("recent", t, data).pass, true);
  assert.equal(evaluate("fresh", t, data).pass, true);
  assert.equal(evaluate("limited", t, data).pass, false);
});

test("a year compares the baseline_low_date year", () => {
  const t2021 = parseTarget("2021");
  assert.equal(evaluate("old", t2021, data).pass, true);
  assert.equal(evaluate("recent", t2021, data).pass, false);
  assert.equal(evaluate("fresh", parseTarget("2024"), data).pass, true);
  assert.equal(evaluate("limited", parseTarget("2024"), data).pass, false);
});

test("a leading '≤' is stripped before comparing years", () => {
  assert.equal(stripRangePrefix("≤2018-01-01"), "2018-01-01");
  assert.equal(evaluate("ranged", parseTarget("2018"), data).pass, true);
  assert.equal(evaluate("ranged", parseTarget("2017"), data).pass, false);
  assert.equal(evaluate("ranged", parseTarget("2018"), data).reason.low, "2018-01-01");
});

test("moved and split ids follow redirects", () => {
  assert.equal(evaluate("moved", parseTarget("widely"), data).pass, true);
  assert.equal(evaluate("chain", parseTarget("widely"), data).pass, true);
  // split: every part must pass
  assert.equal(evaluate("split", parseTarget("widely"), data).pass, false);
  assert.equal(evaluate("split", parseTarget("newly"), data).pass, true);
});

test("unknown ids and redirect loops never pass", () => {
  assert.equal(evaluate("missing", parseTarget("newly"), data).pass, false);
  assert.equal(evaluate("loop", parseTarget("newly"), data).pass, false);
});

test("invalid targets throw with the offending value", () => {
  for (const bad of ["1999", "soon", "20215", "2014", "", "Widely"]) {
    assert.throws(() => parseTarget(bad), (e: unknown) => e instanceof InvalidTargetError && e.value === bad, bad);
  }
  assert.throws(() => parseTarget("2030", new Date("2026-11-13")), InvalidTargetError);
  assert.deepEqual(parseTarget("2015"), { kind: "year", year: 2015 });
});

test("the CLI exits 2 with an English message for --baseline 1999", () => {
  const r = runCli(["examples/legacy-app", "--baseline", "1999", "--lang", "en"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Invalid Baseline target "1999"/);
  assert.equal(r.stdout, "");
});

test("the CLI exits 2 with a Korean message for --baseline soon", () => {
  const r = runCli(["examples/legacy-app", "--baseline", "soon", "--lang", "ko"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /잘못된 Baseline 기준 "soon"/);
});
