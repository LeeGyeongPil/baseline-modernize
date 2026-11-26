import { parse } from "parse5";
import type { DefaultTreeAdapterMap } from "parse5";

export type HtmlElement = DefaultTreeAdapterMap["element"];
type AnyNode = DefaultTreeAdapterMap["node"];

export function parseHtml(src: string): DefaultTreeAdapterMap["document"] {
  return parse(src, { sourceCodeLocationInfo: true });
}

/** Visit every element that exists in the source (implied html/head/body are skipped). */
export function walkElements(root: AnyNode, visit: (el: HtmlElement) => void): void {
  const children = (root as { childNodes?: AnyNode[] }).childNodes ?? [];
  for (const child of children) {
    if ("tagName" in child) {
      if (child.sourceCodeLocation) visit(child);
      const content = (child as { content?: AnyNode }).content;
      if (content) walkElements(content, visit);
    }
    walkElements(child, visit);
  }
}

export interface InlineBlock {
  kind: "js" | "css";
  text: string;
  /** 1-based position of the first character of `text` in the HTML source. */
  line: number;
  column: number;
}

const JS_TYPES = new Set(["", "text/javascript", "module"]);

/** Inline `<script>` (no src; JS or module) and `<style>` bodies with their source position. */
export function inlineBlocks(src: string): InlineBlock[] {
  const out: InlineBlock[] = [];
  walkElements(parseHtml(src), (el) => {
    if (el.tagName !== "script" && el.tagName !== "style") return;
    const attr = (name: string): string | undefined => el.attrs.find((a) => a.name === name)?.value;
    if (el.tagName === "script") {
      if (attr("src") !== undefined) return;
      if (!JS_TYPES.has((attr("type") ?? "").trim().toLowerCase())) return;
    }
    const textNode = el.childNodes.find((n) => n.nodeName === "#text") as
      | { value: string; sourceCodeLocation?: { startLine: number; startCol: number } | null }
      | undefined;
    const loc = textNode?.sourceCodeLocation;
    if (!textNode || !loc || textNode.value.trim() === "") return;
    out.push({ kind: el.tagName === "script" ? "js" : "css", text: textNode.value, line: loc.startLine, column: loc.startCol });
  });
  return out;
}
