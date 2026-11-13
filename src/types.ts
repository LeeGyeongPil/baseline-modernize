export type Confidence = "certain" | "suspect";
export type RuleTarget = "js" | "css" | "markup";
export type Lang = "en" | "ko";

/** A raw detection before the Baseline gate decides whether to report it. */
export interface Candidate {
  rule: string;
  file: string;
  line: number;
  column: number;
  /** Normalised source excerpt used for the known-findings fingerprint. */
  snippet: string;
  /** Replacement feature id; defaults to the rule's own id list when omitted. */
  featureId?: string;
  /** Values substituted into the localised message. */
  params?: Record<string, string>;
}

export interface RuleMeta {
  id: string;
  target: RuleTarget;
  confidence: Confidence;
  /** Replacement web-features ids (resolved from data for the discouraged rules). */
  featureIds: () => string[];
}

export interface Finding {
  rule: string;
  file: string;
  line: number;
  column: number;
  confidence: Confidence;
  featureId: string;
  message: string;
  baseline: "high" | "low";
  known: boolean;
  fingerprint: string;
}

export interface SilencedFinding {
  rule: string;
  file: string;
  line: number;
  column: number;
  featureId: string;
  reason: GateReason;
}

export interface GateReason {
  id: string;
  baseline: string;
  low: string | null;
  target: string;
}

export type SkipReason = "parse-error" | "default-dir" | "minified" | "excluded" | "unsupported" | "unreadable";

export interface Skipped {
  path: string;
  reason: SkipReason;
}

export interface ScanResult {
  findings: Finding[];
  silenced: SilencedFinding[];
  skipped: Skipped[];
  filesScanned: number;
}
