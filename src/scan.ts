import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { evaluate, type Target } from "./baseline/gate.js";
import { loadData, resolveFeatureIds } from "./baseline/data.js";
import { collectFiles, kindOf } from "./files.js";
import { t } from "./i18n/index.js";
import { fingerprint } from "./known.js";
import { CssParseError, parseCss } from "./parsers/css.js";
import { ParseError, parseJs } from "./parsers/js.js";
import { detectCss } from "./rules/css.js";
import { RULES, findRule } from "./rules/index.js";
import { detectJs } from "./rules/js.js";
import { detectMarkup, htmlElements, jsxElements } from "./rules/markup.js";
import type { Candidate, Confidence, Finding, Lang, ScanResult, SilencedFinding } from "./types.js";

export interface ScanOptions {
  paths: string[];
  cwd: string;
  target: Target;
  lang: Lang;
  exclude?: string[];
  /** "certain" hides suspect findings. */
  confidence?: "all" | Confidence;
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export async function detectFile(rel: string, src: string): Promise<Candidate[]> {
  const kind = kindOf(rel);
  if (kind === "js") {
    const parsed = await parseJs(rel, src);
    return [...detectJs(parsed, rel), ...detectMarkup(jsxElements(parsed), rel)];
  }
  if (kind === "css") return detectCss(parseCss(rel, src), rel);
  return detectMarkup(htmlElements(src), rel);
}

export async function scan(opts: ScanOptions): Promise<ScanResult> {
  const { files, skipped } = collectFiles(opts.paths, opts.cwd, opts.exclude ?? []);
  const data = loadData();
  const findings: Finding[] = [];
  const silenced: SilencedFinding[] = [];
  let filesScanned = 0;

  for (const rel of files) {
    const src = readFileSync(resolve(opts.cwd, rel), "utf8").replace(/^﻿/, "");
    let candidates: Candidate[];
    try {
      candidates = await detectFile(rel, src);
    } catch (err) {
      if (err instanceof ParseError || err instanceof CssParseError) {
        skipped.push({ path: rel, reason: "parse-error" });
        continue;
      }
      throw err;
    }
    filesScanned++;
    for (const c of candidates) {
      const rule = findRule(c.rule);
      if (!rule) continue;
      if (opts.confidence === "certain" && rule.confidence === "suspect") continue;
      const featureId = c.featureId ?? rule.featureIds()[0] ?? "";
      const gate = evaluate(featureId, opts.target, data);
      if (!gate.pass) {
        silenced.push({ rule: c.rule, file: c.file, line: c.line, column: c.column, featureId, reason: gate.reason });
        continue;
      }
      const resolved = resolveFeatureIds(featureId, data)[0] ?? featureId;
      findings.push({
        rule: c.rule,
        file: c.file,
        line: c.line,
        column: c.column,
        confidence: rule.confidence,
        featureId: resolved,
        message: t(opts.lang, `rule.${c.rule}.message` as never, c.params ?? {}),
        baseline: gate.baseline === "high" ? "high" : "low",
        known: false,
        fingerprint: fingerprint(c.rule, c.file, c.snippet),
      });
    }
  }

  const order = (a: { file: string; line: number; column: number; rule: string }, b: typeof a): number =>
    cmp(a.file, b.file) || a.line - b.line || a.column - b.column || cmp(a.rule, b.rule);
  findings.sort(order);
  silenced.sort(order);
  skipped.sort((a, b) => cmp(a.path, b.path) || cmp(a.reason, b.reason));
  return { findings, silenced, skipped, filesScanned };
}

export { RULES };
