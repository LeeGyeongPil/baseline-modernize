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
