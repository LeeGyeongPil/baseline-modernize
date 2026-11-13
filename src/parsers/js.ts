import { extname } from "node:path";
import { LineTable } from "./lines.js";

export interface AstNode {
  type: string;
  start: number;
  end: number;
  [key: string]: unknown;
}

export interface ParsedJs {
  program: AstNode;
  src: string;
  lines: LineTable;
}

export class ParseError extends Error {}
export class ParserLoadError extends Error {}

type OxcModule = typeof import("oxc-parser");
let oxc: OxcModule | undefined;

async function loadOxc(): Promise<OxcModule> {
  if (!oxc) {
    try {
      oxc = await import("oxc-parser");
    } catch (err) {
      throw new ParserLoadError(err instanceof Error ? err.message : String(err));
    }
  }
  return oxc;
}

function langFor(file: string): "js" | "jsx" | "ts" | "tsx" {
  switch (extname(file).toLowerCase()) {
    case ".ts":
    case ".mts":
    case ".cts":
      return "ts";
    case ".tsx":
      return "tsx";
    case ".js":
    case ".mjs":
    case ".cjs":
      // Plain .js files in the wild often contain JSX, so accept it.
      return "jsx";
    default:
      return "jsx";
  }
}

export async function parseJs(file: string, src: string): Promise<ParsedJs> {
  const mod = await loadOxc();
  const res = mod.parseSync(file, src, { lang: langFor(file), preserveParens: false });
  if (res.errors.length > 0) {
    throw new ParseError(res.errors[0]?.message ?? "syntax error");
  }
  return { program: res.program as unknown as AstNode, src, lines: new LineTable(src) };
}

/** Depth-first walk over an ESTree-shaped tree, passing the parent along. */
export function walk(node: AstNode, visit: (n: AstNode, parent: AstNode | null) => void, parent: AstNode | null = null): void {
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === "type" || key === "start" || key === "end") continue;
    const value = node[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isNode(item)) walk(item, visit, node);
      }
    } else if (isNode(value)) {
      walk(value, visit, node);
    }
  }
}

export function isNode(v: unknown): v is AstNode {
  return typeof v === "object" && v !== null && typeof (v as { type?: unknown }).type === "string";
}
