import type { ReportContext } from "./context.js";
import { summarize } from "./context.js";

export function renderJson(ctx: ReportContext): string {
  const { result } = ctx;
  const body = {
    tool: "baseline-modernize",
    webFeatures: ctx.webFeatures,
    baseline: ctx.baseline,
    findings: result.findings,
    silenced: result.silenced,
    skipped: result.skipped,
    summary: summarize(result),
  };
  return JSON.stringify(body, null, 2) + "\n";
}
