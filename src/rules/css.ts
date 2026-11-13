import type { Root } from "postcss";
import type { Candidate } from "../types.js";
import { normalizeSnippet } from "../parsers/lines.js";

/**
 * Vendor-prefixed property -> web-features id of the standard feature.
 * Whitelist only: prefixes with no standard replacement (-webkit-line-clamp,
 * -webkit-text-size-adjust, ...) are deliberately absent.
 */
export const PREFIX_WHITELIST: Record<string, { plain: string; featureId: string }> = {
  "-webkit-appearance": { plain: "appearance", featureId: "appearance" },
  "-moz-appearance": { plain: "appearance", featureId: "appearance" },
  "-webkit-border-radius": { plain: "border-radius", featureId: "border-radius" },
  "-moz-border-radius": { plain: "border-radius", featureId: "border-radius" },
  "-webkit-box-shadow": { plain: "box-shadow", featureId: "box-shadow" },
  "-moz-box-shadow": { plain: "box-shadow", featureId: "box-shadow" },
  "-webkit-box-sizing": { plain: "box-sizing", featureId: "box-sizing" },
  "-moz-box-sizing": { plain: "box-sizing", featureId: "box-sizing" },
  "-webkit-transition": { plain: "transition", featureId: "transitions" },
  "-moz-transition": { plain: "transition", featureId: "transitions" },
  "-o-transition": { plain: "transition", featureId: "transitions" },
  "-webkit-transform": { plain: "transform", featureId: "transforms2d" },
  "-moz-transform": { plain: "transform", featureId: "transforms2d" },
  "-ms-transform": { plain: "transform", featureId: "transforms2d" },
  "-webkit-animation": { plain: "animation", featureId: "animations-css" },
  "-moz-animation": { plain: "animation", featureId: "animations-css" },
  "-webkit-filter": { plain: "filter", featureId: "filter" },
  "-moz-tab-size": { plain: "tab-size", featureId: "tab-size" },
};

/** CSS properties that web-features marks as discouraged, keyed by the rule that reports them. */
export const DISCOURAGED_PROPS: Record<string, { prop: string; featureId: string }> = {
  "discouraged-clip": { prop: "clip", featureId: "clip" },
  "discouraged-color-adjust": { prop: "color-adjust", featureId: "color-adjust" },
};

const RATIOS: Record<string, string> = { "56.25%": "16 / 9", "75%": "4 / 3" };
const OWL = /(^|[\s>+~])\*\s*\+\s*\*$/;
const MARGIN_PROPS = new Set(["margin-top", "margin-left", "margin-block-start", "margin-inline-start"]);

export function detectCss(root: Root, file: string): Candidate[] {
  const out: Candidate[] = [];

  root.walkDecls((decl) => {
    const start = decl.source?.start;
    if (!start) return;
    const prop = decl.prop.toLowerCase();
    const where = { file, line: start.line, column: start.column, snippet: normalizeSnippet(`${decl.prop}: ${decl.value}`) };

    const prefixed = PREFIX_WHITELIST[prop];
    if (prefixed) {
      out.push({ rule: "unneeded-prefix", ...where, featureId: prefixed.featureId, params: { prop: decl.prop, plain: prefixed.plain } });
    }

    if ((prop === "padding-top" || prop === "padding-bottom") && RATIOS[decl.value.trim()]) {
      const ratio = RATIOS[decl.value.trim()] as string;
      out.push({ rule: "padding-hack-ratio", ...where, params: { prop: decl.prop, value: decl.value.trim(), ratio } });
    }

    for (const [rule, d] of Object.entries(DISCOURAGED_PROPS)) {
      if (prop === d.prop) out.push({ rule, ...where, params: { prop: decl.prop } });
    }
  });

  root.walkRules((rule) => {
    const start = rule.source?.start;
    if (!start) return;
    const isOwl = rule.selectors.some((s) => OWL.test(s.trim()));
    if (!isOwl) return;
    const margin = rule.nodes.find((n) => n.type === "decl" && MARGIN_PROPS.has(n.prop.toLowerCase()));
    if (margin && margin.type === "decl") {
      out.push({
        rule: "owl-spacing",
        file,
        line: start.line,
        column: start.column,
        snippet: normalizeSnippet(`${rule.selector} { ${margin.prop}: ${margin.value} }`),
      });
    }
  });

  return out;
}
