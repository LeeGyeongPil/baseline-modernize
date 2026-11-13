import type { GateReason } from "../types.js";
import { loadData, resolveFeatureIds, type BaselineData } from "./data.js";

export type Target = { kind: "widely" } | { kind: "newly" } | { kind: "year"; year: number };

/** Thrown for an invalid --baseline value; the CLI maps `value` into a localised message. */
export class InvalidTargetError extends Error {
  constructor(readonly value: string) {
    super(`Invalid Baseline target "${value}". Use widely, newly, or a year such as 2021.`);
    this.name = "InvalidTargetError";
  }
}

export const FIRST_BASELINE_YEAR = 2015;

export function parseTarget(value: string, now: Date = new Date()): Target {
  if (value === "widely") return { kind: "widely" };
  if (value === "newly") return { kind: "newly" };
  if (/^\d{4}$/.test(value)) {
    const year = Number(value);
    if (year >= FIRST_BASELINE_YEAR && year <= now.getFullYear()) return { kind: "year", year };
  }
  throw new InvalidTargetError(value);
}

export function targetLabel(t: Target): string {
  return t.kind === "year" ? String(t.year) : t.kind;
}

/** web-features writes some dates as "≤2020-01-01" (the real date is on or before it). */
export function stripRangePrefix(date: string): string {
  return date.replace(/^≤\s*/, "");
}

export interface GateResult {
  pass: boolean;
  reason: GateReason;
  /** Baseline state of the (resolved) replacement used for display. */
  baseline: "high" | "low" | "false";
}

/**
 * Decide whether a replacement id is acceptable for the chosen target.
 * A moved/split id follows its redirects; a split passes only if every part passes.
 * Unknown ids never pass.
 */
export function evaluate(id: string, target: Target, data: BaselineData = loadData()): GateResult {
  const resolved = resolveFeatureIds(id, data);
  const label = targetLabel(target);
  if (resolved.length === 0) {
    return { pass: false, baseline: "false", reason: { id, baseline: "unknown", low: null, target: label } };
  }
  let worst: GateResult | undefined;
  for (const rid of resolved) {
    const res = evaluateOne(rid, target, data);
    if (!res.pass) return res;
    worst ??= res;
    if (res.baseline === "low") worst = res;
  }
  return worst as GateResult;
}

function evaluateOne(id: string, target: Target, data: BaselineData): GateResult {
  const f = data.features[id];
  const baseline = f?.baseline === "high" || f?.baseline === "low" ? f.baseline : "false";
  const low = f?.low ? stripRangePrefix(f.low) : null;
  const reason: GateReason = { id, baseline, low, target: targetLabel(target) };
  let pass: boolean;
  if (target.kind === "widely") pass = baseline === "high";
  else if (target.kind === "newly") pass = baseline === "high" || baseline === "low";
  else pass = baseline !== "false" && low !== null && Number(low.slice(0, 4)) <= target.year;
  return { pass, reason, baseline };
}
