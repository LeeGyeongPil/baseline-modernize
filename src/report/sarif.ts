import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXPLORER_BASE, explorerUrl } from "../baseline/data.js";
import { t, type MessageKey } from "../i18n/index.js";
import { RULES } from "../rules/index.js";
import type { ReportContext } from "./context.js";

export function toolVersion(): string {
  const url = new URL("../../package.json", import.meta.url);
  return (JSON.parse(readFileSync(fileURLToPath(url), "utf8")) as { version: string }).version;
}

export function renderSarif(ctx: ReportContext): string {
  const { lang, result } = ctx;
  const rules = RULES.map((r) => {
    const ids = r.featureIds();
    return {
      id: r.id,
      shortDescription: { text: t(lang, `rule.${r.id}.title` as MessageKey) },
      helpUri: ids.length === 1 ? explorerUrl(ids[0] as string) : EXPLORER_BASE,
      defaultConfiguration: { level: r.confidence === "certain" ? "error" : "warning" },
      properties: { webFeatures: ids, confidence: r.confidence },
    };
  });
  const results = result.findings.map((f) => ({
    ruleId: f.rule,
    ruleIndex: RULES.findIndex((r) => r.id === f.rule),
    level: f.confidence === "certain" ? "error" : "warning",
    message: { text: f.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: f.file },
          region: { startLine: f.line, startColumn: f.column },
        },
      },
    ],
    partialFingerprints: { "baselineModernize/v1": f.fingerprint },
    ...(ctx.usedKnown ? { baselineState: f.known ? "unchanged" : "new" } : {}),
    properties: { webFeatures: [f.featureId], baseline: ctx.baseline },
  }));
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: { driver: { name: "baseline-modernize", version: toolVersion(), rules } },
        results,
        properties: { webFeatures: ctx.webFeatures, baseline: ctx.baseline },
      },
    ],
  };
  return JSON.stringify(sarif, null, 2) + "\n";
}
