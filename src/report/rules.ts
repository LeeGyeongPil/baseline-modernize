import { loadData, resolveFeatureIds } from "../baseline/data.js";
import { evaluate, type Target, targetLabel } from "../baseline/gate.js";
import { displayWidth, padEnd, t, type MessageKey } from "../i18n/index.js";
import { RULES } from "../rules/index.js";
import type { Lang } from "../types.js";

export interface RuleRow {
  id: string;
  target: string;
  replacement: string;
  status: string;
  result: string;
}

export function ruleRows(lang: Lang, target: Target): RuleRow[] {
  const data = loadData();
  return RULES.map((r) => {
    const ids = r.featureIds();
    const gates = ids.map((id) => evaluate(id, target, data));
    const passed = gates.filter((g) => g.pass).length;
    const result = passed === gates.length ? "rules.pass" : passed === 0 ? "rules.silenced" : "rules.partial";
    const states = [...new Set(ids.flatMap((id) => resolveFeatureIds(id, data).map((rid) => String(data.features[rid]?.baseline ?? false))))];
    return {
      id: r.id,
      target: t(lang, `target.${r.target}` as MessageKey),
      replacement: ids.length > 2 ? ids.slice(0, 2).join(", ") + ", …" : ids.join(", "),
      status: states.map((s) => t(lang, `status.${s}` as MessageKey)).join("/"),
      result: t(lang, result as MessageKey),
    };
  });
}

export function renderRules(lang: Lang, target: Target): string {
  const rows = ruleRows(lang, target);
  const header: RuleRow = {
    id: t(lang, "rules.id"),
    target: t(lang, "rules.target"),
    replacement: t(lang, "rules.replacement"),
    status: t(lang, "rules.status"),
    result: t(lang, "rules.result"),
  };
  const all = [header, ...rows];
  const w = (k: keyof RuleRow): number => Math.max(...all.map((r) => displayWidth(r[k])));
  const widths = { id: w("id"), target: w("target"), replacement: w("replacement"), status: w("status") };
  const line = (r: RuleRow): string =>
    `${padEnd(r.id, widths.id)}  ${padEnd(r.target, widths.target)}  ${padEnd(r.replacement, widths.replacement)}  ${padEnd(r.status, widths.status)}  ${r.result}`;
  const out = all.map(line);
  out.push("");
  out.push(t(lang, "out.footer", { version: loadData().webFeaturesVersion, baseline: targetLabel(target) }));
  return out.join("\n") + "\n";
}
