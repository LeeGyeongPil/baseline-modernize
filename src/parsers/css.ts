import postcss, { type Root } from "postcss";

export class CssParseError extends Error {}

export function parseCss(file: string, src: string): Root {
  try {
    return postcss.parse(src, { from: file });
  } catch (err) {
    throw new CssParseError(err instanceof Error ? err.message : String(err));
  }
}
