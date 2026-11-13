import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export interface FeatureEntry {
  kind: "feature" | "moved" | "split";
  name?: string;
  baseline?: "high" | "low" | false;
  low?: string;
  high?: string;
  alternatives?: string[];
  redirects?: string[];
}

export interface BaselineData {
  webFeaturesVersion: string;
  features: Record<string, FeatureEntry>;
}

let cached: BaselineData | undefined;

/** Load the committed snapshot of web-features. Runtime never touches the network. */
export function loadData(): BaselineData {
  if (!cached) {
    const url = new URL("../../data/baseline.json", import.meta.url);
    cached = JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as BaselineData;
  }
  return cached;
}

/**
 * Follow moved/split redirects until only real features remain.
 * Returns [] when the id is unknown or the redirect chain is broken.
 */
export function resolveFeatureIds(id: string, data: BaselineData = loadData()): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const visit = (cur: string): void => {
    if (seen.has(cur)) return;
    seen.add(cur);
    const entry = data.features[cur];
    if (!entry) return;
    if (entry.kind === "feature") {
      out.push(cur);
      return;
    }
    for (const next of entry.redirects ?? []) visit(next);
  };
  visit(id);
  return out;
}

export function explorerUrl(id: string): string {
  return `https://web-platform-dx.github.io/web-features-explorer/features/${id}/`;
}

export const EXPLORER_BASE = "https://web-platform-dx.github.io/web-features-explorer/";
