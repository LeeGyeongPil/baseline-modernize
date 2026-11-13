import type { Lang, ScanResult } from "../types.js";

export interface ReportContext {
  lang: Lang;
  /** Label of the chosen target: widely, newly or a year. */
  baseline: string;
  webFeatures: string;
  /** True when a --known file was applied. */
  usedKnown: boolean;
  explain: boolean;
  result: ScanResult;
}

export function summarize(result: ScanResult) {
  const known = result.findings.filter((f) => f.known).length;
  return {
    findings: result.findings.length,
    new: result.findings.length - known,
    known,
    silenced: result.silenced.length,
    skipped: result.skipped.length,
    files: result.filesScanned,
  };
}
