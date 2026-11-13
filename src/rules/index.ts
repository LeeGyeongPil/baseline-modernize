import type { RuleMeta } from "../types.js";
import { loadData } from "../baseline/data.js";
import { DISCOURAGED_PROPS, PREFIX_WHITELIST } from "./css.js";

const fixed = (...ids: string[]) => () => ids;

/** Replacement ids of a discouraged-property rule come from web-features itself. */
const fromDiscouraged = (rule: string) => () => {
  const src = DISCOURAGED_PROPS[rule];
  const alts = src ? loadData().features[src.featureId]?.alternatives : undefined;
  return alts ? [...alts] : [];
};

/** Registered rules, sorted by id. */
export const RULES: RuleMeta[] = [
  { id: "array-last-index", target: "js", confidence: "certain", featureIds: fixed("array-at") },
  { id: "discouraged-clip", target: "css", confidence: "certain", featureIds: fromDiscouraged("discouraged-clip") },
  { id: "discouraged-color-adjust", target: "css", confidence: "certain", featureIds: fromDiscouraged("discouraged-color-adjust") },
  { id: "div-dialog", target: "markup", confidence: "certain", featureIds: fixed("dialog") },
  { id: "hasown-call", target: "js", confidence: "certain", featureIds: fixed("object-hasown") },
  { id: "img-data-src", target: "markup", confidence: "certain", featureIds: fixed("loading-lazy") },
  { id: "js-accordion", target: "markup", confidence: "suspect", featureIds: fixed("details-name") },
  { id: "json-deep-clone", target: "js", confidence: "certain", featureIds: fixed("structured-clone") },
  { id: "owl-spacing", target: "css", confidence: "suspect", featureIds: fixed("flexbox-gap") },
  { id: "padding-hack-ratio", target: "css", confidence: "certain", featureIds: fixed("aspect-ratio") },
  { id: "scroll-listener", target: "js", confidence: "suspect", featureIds: fixed("intersection-observer") },
  {
    id: "unneeded-prefix",
    target: "css",
    confidence: "certain",
    featureIds: () => [...new Set(Object.values(PREFIX_WHITELIST).map((p) => p.featureId))].sort(),
  },
  { id: "xhr", target: "js", confidence: "certain", featureIds: fixed("fetch") },
];

export function findRule(id: string): RuleMeta | undefined {
  return RULES.find((r) => r.id === id);
}
