import type { Candidate } from "../types.js";
import { walk, type AstNode, type ParsedJs } from "../parsers/js.js";
import { normalizeSnippet } from "../parsers/lines.js";
import { parseHtml, walkElements } from "../parsers/html.js";

/** One element in a shape shared by JSX and HTML so each rule is written once. */
export interface MarkupEl {
  tag: string;
  /** attribute name (lower case, class/on* normalised) -> value; null when the value is dynamic */
  attrs: Map<string, string | null>;
  /** JSX spread attributes make the attribute set unknown */
  spread: boolean;
  line: number;
  column: number;
  snippet: string;
}

const asNode = (v: unknown): AstNode | undefined =>
  typeof v === "object" && v !== null && typeof (v as AstNode).type === "string" ? (v as AstNode) : undefined;

function jsxAttrName(raw: string): string {
  if (raw === "className") return "class";
  if (/^on[A-Z]/.test(raw)) return raw.toLowerCase();
  return raw;
}

function jsxAttrValue(value: AstNode | undefined): string | null {
  if (!value) return ""; // <img loading /> style boolean attribute
  if (value.type === "Literal" && typeof value.value === "string") return value.value;
  if (value.type === "JSXExpressionContainer") {
    const inner = asNode(value.expression);
    if (inner?.type === "Literal" && typeof inner.value === "string") return inner.value;
    if (inner?.type === "TemplateLiteral" && (inner.expressions as unknown[]).length === 0) {
      const quasi = asNode((inner.quasis as unknown[])[0]);
      const cooked = (quasi?.value as { cooked?: string } | undefined)?.cooked;
      if (typeof cooked === "string") return cooked;
    }
  }
  return null;
}

export function jsxElements(parsed: ParsedJs): MarkupEl[] {
  const out: MarkupEl[] = [];
  walk(parsed.program, (node) => {
    if (node.type !== "JSXOpeningElement") return;
    const name = asNode(node.name);
    if (name?.type !== "JSXIdentifier") return;
    const tag = name.name as string;
    if (!/^[a-z]/.test(tag)) return; // components are not DOM elements
    const attrs = new Map<string, string | null>();
    let spread = false;
    for (const raw of node.attributes as unknown[]) {
      const attr = asNode(raw);
      if (!attr) continue;
      if (attr.type === "JSXSpreadAttribute") {
        spread = true;
        continue;
      }
      const nm = asNode(attr.name);
      if (nm?.type !== "JSXIdentifier") continue;
      attrs.set(jsxAttrName(nm.name as string), jsxAttrValue(asNode(attr.value)));
    }
    const pos = parsed.lines.position(node.start);
    out.push({ tag, attrs, spread, line: pos.line, column: pos.column, snippet: normalizeSnippet(parsed.src.slice(node.start, node.end)) });
  });
  return out;
}

export function htmlElements(src: string): MarkupEl[] {
  const out: MarkupEl[] = [];
  walkElements(parseHtml(src), (el) => {
    const loc = el.sourceCodeLocation;
    if (!loc) return;
    const attrs = new Map<string, string | null>();
    for (const a of el.attrs) attrs.set(a.name, a.value);
    const startTag = loc.startTag ?? loc;
    out.push({
      tag: el.tagName,
      attrs,
      spread: false,
      line: loc.startLine,
      column: loc.startCol,
      snippet: normalizeSnippet(src.slice(startTag.startOffset, startTag.endOffset)),
    });
  });
  return out;
}

const firstToken = (v: string | null | undefined): string => (v ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";

export function detectMarkup(els: MarkupEl[], file: string): Candidate[] {
  const out: Candidate[] = [];
  const add = (rule: string, el: MarkupEl, params?: Record<string, string>): void => {
    out.push({ rule, file, line: el.line, column: el.column, snippet: el.snippet, ...(params ? { params } : {}) });
  };
  for (const el of els) {
    if (el.tag === "div") {
      const role = firstToken(el.attrs.get("role"));
      if (role === "dialog" || role === "alertdialog") add("div-dialog", el, { role });

      const cls = el.attrs.get("class");
      if (typeof cls === "string" && /accordion/i.test(cls) && el.attrs.has("onclick")) add("js-accordion", el);
    }
    if (el.tag === "img" && el.attrs.has("data-src") && !el.attrs.has("loading") && !el.spread) {
      add("img-data-src", el);
    }
  }
  return out;
}
