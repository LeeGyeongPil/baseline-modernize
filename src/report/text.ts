import { explorerUrl } from "../baseline/data.js";
import { t, unit, type MessageKey } from "../i18n/index.js";
import type { GateReason } from "../types.js";
import type { ReportContext } from "./context.js";
import { summarize } from "./context.js";

export function gateReasonText(lang: ReportContext["lang"], r: GateReason): string {
  if (r.baseline === "unknown") return t(lang, "reason.unknown", { id: r.id });
  if (r.target === "widely") return t(lang, "reason.widely", { id: r.id, baseline: r.baseline });
  if (r.target === "newly") return t(lang, "reason.newly", { id: r.id, baseline: r.baseline });
  if (r.baseline === "false" || r.low === null) return t(lang, "reason.yearNone", { id: r.id, baseline: r.baseline, year: r.target });
  return t(lang, "reason.year", { id: r.id, low: r.low, year: r.target });
}

export function renderText(ctx: ReportContext): string {
  const { lang, result } = ctx;
  const lines: string[] = [];
  const fresh = result.findings.filter((f) => !f.known);

  for (const f of fresh) {
    lines.push(`${f.file}:${f.line}:${f.column}  ${f.rule}  [${t(lang, `conf.${f.confidence}` as MessageKey)}]`);
    lines.push(`  ${f.message}`);
    const label = t(lang, f.baseline === "high" ? "out.baselineWidely" : "out.baselineNewly");
    lines.push(`  ${t(lang, "out.replace")}: ${f.featureId} (${label})  ${explorerUrl(f.featureId)}`);
    lines.push("");
  }
  if (fresh.length === 0) {
    const known = result.findings.length;
    lines.push(known === 0 ? t(lang, "out.none") : t(lang, "out.noneNew", { known }));
    lines.push("");
  }

  if (ctx.explain && result.silenced.length > 0) {
    lines.push(t(lang, "out.silenced"));
    for (const s of result.silenced) {
      lines.push(`  ${s.file}:${s.line}:${s.column}  ${s.rule}  ${gateReasonText(lang, s.reason)}`);
    }
    lines.push("");
  }

  const s = summarize(result);
  lines.push(t(lang, "out.summary", { findings: unit(lang, "findings", s.findings), new: s.new, known: s.known, silenced: s.silenced, files: unit(lang, "files", s.files) }));
  lines.push(t(lang, "out.footer", { version: ctx.webFeatures, baseline: ctx.baseline }));
  if (result.skipped.length > 0) {
    lines.push(t(lang, "out.skipped"));
    for (const k of result.skipped) lines.push(`  ${k.path} (${t(lang, `skip.${k.reason}` as MessageKey)})`);
  }
  return lines.join("\n") + "\n";
}
