import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import type { Finding } from "./types.js";

export interface KnownEntry {
  rule: string;
  file: string;
  fingerprint: string;
  count: number;
}

export interface KnownFile {
  tool: "baseline-modernize";
  version: 1;
  entries: KnownEntry[];
}

export class KnownFormatError extends Error {}

/** Rule + file + normalised code excerpt: survives lines moving up or down. */
export function fingerprint(rule: string, file: string, snippet: string): string {
  return createHash("sha256").update(`${rule}\0${file}\0${snippet}`).digest("hex").slice(0, 16);
}

export function buildKnown(findings: Pick<Finding, "rule" | "file" | "fingerprint">[]): KnownFile {
  const map = new Map<string, KnownEntry>();
  for (const f of findings) {
    const cur = map.get(f.fingerprint);
    if (cur) cur.count++;
    else map.set(f.fingerprint, { rule: f.rule, file: f.file, fingerprint: f.fingerprint, count: 1 });
  }
  const entries = [...map.values()].sort((a, b) =>
    a.file !== b.file ? (a.file < b.file ? -1 : 1) : a.rule !== b.rule ? (a.rule < b.rule ? -1 : 1) : a.fingerprint < b.fingerprint ? -1 : 1,
  );
  return { tool: "baseline-modernize", version: 1, entries };
}

export function writeKnownFile(path: string, known: KnownFile): void {
  writeFileSync(path, JSON.stringify(known, null, 2) + "\n");
}

export function readKnownFile(path: string): KnownFile {
  const raw = readFileSync(path, "utf8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new KnownFormatError(path);
  }
  const k = parsed as Partial<KnownFile>;
  if (k?.tool !== "baseline-modernize" || k.version !== 1 || !Array.isArray(k.entries)) throw new KnownFormatError(path);
  return k as KnownFile;
}

/** Mark the first `count` occurrences of each recorded fingerprint as known. */
export function applyKnown(findings: Finding[], known: KnownFile): void {
  const budget = new Map<string, number>();
  for (const e of known.entries) budget.set(e.fingerprint, (budget.get(e.fingerprint) ?? 0) + e.count);
  for (const f of findings) {
    const left = budget.get(f.fingerprint) ?? 0;
    if (left > 0) {
      f.known = true;
      budget.set(f.fingerprint, left - 1);
    }
  }
}
