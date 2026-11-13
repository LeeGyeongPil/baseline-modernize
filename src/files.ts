import { existsSync, readdirSync, statSync } from "node:fs";
import { extname, relative, resolve, sep } from "node:path";
import type { Skipped } from "./types.js";

export const DEFAULT_SKIP_DIRS = ["node_modules", ".git", "dist", "build", "coverage", "vendor"];
const JS_EXT = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]);
const CSS_EXT = new Set([".css"]);
const HTML_EXT = new Set([".html", ".htm"]);

export type FileKind = "js" | "css" | "html";

export function kindOf(file: string): FileKind | undefined {
  const ext = extname(file).toLowerCase();
  if (JS_EXT.has(ext)) return "js";
  if (CSS_EXT.has(ext)) return "css";
  if (HTML_EXT.has(ext)) return "html";
  return undefined;
}

export class PathNotFoundError extends Error {
  constructor(readonly path: string) {
    super(`Path not found: ${path}`);
    this.name = "PathNotFoundError";
  }
}

export interface Collected {
  /** Relative, "/"-separated, sorted. */
  files: string[];
  skipped: Skipped[];
}

export function toPosix(p: string): string {
  return sep === "/" ? p : p.split(sep).join("/");
}

const isMinified = (name: string): boolean => /\.min\.[^.]+$/i.test(name);

/** Walk the given paths in sorted order and apply the skip rules. */
export function collectFiles(paths: string[], cwd: string, exclude: string[] = []): Collected {
  const files = new Set<string>();
  const skipped: Skipped[] = [];
  const prefixes = exclude.map((p) => toPosix(p).replace(/^\.\//, ""));
  const excluded = (rel: string): boolean => prefixes.some((p) => p !== "" && rel.startsWith(p));

  const visitFile = (abs: string, explicit: boolean): void => {
    const rel = toPosix(relative(cwd, abs));
    if (excluded(rel)) {
      skipped.push({ path: rel, reason: "excluded" });
      return;
    }
    if (!kindOf(abs)) {
      if (explicit) skipped.push({ path: rel, reason: "unsupported" });
      return;
    }
    if (isMinified(abs)) {
      skipped.push({ path: rel, reason: "minified" });
      return;
    }
    files.add(rel);
  };

  const visitDir = (abs: string): void => {
    let entries;
    try {
      entries = readdirSync(abs, { withFileTypes: true });
    } catch {
      // Unreadable folder: record it and keep scanning the rest.
      skipped.push({ path: toPosix(relative(cwd, abs)) || ".", reason: "unreadable" });
      return;
    }
    entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const child = resolve(abs, entry.name);
      const rel = toPosix(relative(cwd, child));
      if (entry.isDirectory()) {
        if (DEFAULT_SKIP_DIRS.includes(entry.name)) skipped.push({ path: rel, reason: "default-dir" });
        else if (excluded(rel)) skipped.push({ path: rel, reason: "excluded" });
        else visitDir(child);
      } else if (entry.isFile()) {
        visitFile(child, false);
      }
    }
  };

  for (const p of paths) {
    const abs = resolve(cwd, p);
    if (!existsSync(abs)) throw new PathNotFoundError(p);
    if (statSync(abs).isDirectory()) visitDir(abs);
    else visitFile(abs, true);
  }
  skipped.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  return { files: [...files].sort(), skipped };
}
