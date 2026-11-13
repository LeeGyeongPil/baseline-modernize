import type { Lang } from "../types.js";
import { en, type MessageKey } from "./en.js";
import { ko } from "./ko.js";

export type { MessageKey };
export const MESSAGES: Record<Lang, Record<MessageKey, string>> = { en, ko };

export const TOOL_LANG_ENV = "BASELINE_MODERNIZE_LANG";

export function isLang(v: string): v is Lang {
  return v === "en" || v === "ko";
}

/**
 * Language order: --lang flag > BASELINE_MODERNIZE_LANG > LC_ALL > LC_MESSAGES > LANG.
 * The first non-empty source decides; a value starting with "ko" means Korean, anything else English.
 */
export function resolveLang(flag: string | undefined, env: NodeJS.ProcessEnv): Lang {
  if (flag !== undefined && isLang(flag)) return flag;
  for (const name of [TOOL_LANG_ENV, "LC_ALL", "LC_MESSAGES", "LANG"]) {
    const v = env[name];
    if (v) return v.toLowerCase().startsWith("ko") ? "ko" : "en";
  }
  return "en";
}

export function t(lang: Lang, key: MessageKey, params: Record<string, string | number> = {}): string {
  return MESSAGES[lang][key].replace(/\{(\w+)\}/g, (m, name: string) => (name in params ? String(params[name]) : m));
}

/** Pick the singular or plural unit text for a count ("unit.<name>.one|other"). */
export function unit(lang: Lang, name: "findings" | "files", n: number): string {
  return t(lang, `unit.${name}.${n === 1 ? "one" : "other"}` as MessageKey, { n });
}

/** East Asian wide ranges (Hangul, CJK, fullwidth forms); "…" and other narrow symbols are 1 column. */
function isWide(c: number): boolean {
  return (c >= 0x1100 && c <= 0x115f) || (c >= 0x2e80 && c <= 0xa4cf) || (c >= 0xac00 && c <= 0xd7a3) || (c >= 0xf900 && c <= 0xfaff) || (c >= 0xfe30 && c <= 0xfe6f) || (c >= 0xff00 && c <= 0xff60) || (c >= 0xffe0 && c <= 0xffe6) || c >= 0x20000;
}

/** Display width: CJK characters take two columns. */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += isWide(ch.codePointAt(0) as number) ? 2 : 1;
  return w;
}

export function padEnd(s: string, width: number): string {
  return s + " ".repeat(Math.max(0, width - displayWidth(s)));
}
