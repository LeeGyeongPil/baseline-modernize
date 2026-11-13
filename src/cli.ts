#!/usr/bin/env node
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { loadData } from "./baseline/data.js";
import { FIRST_BASELINE_YEAR, InvalidTargetError, parseTarget, targetLabel, type Target } from "./baseline/gate.js";
import { PathNotFoundError } from "./files.js";
import { isLang, resolveLang, t, type MessageKey } from "./i18n/index.js";
import { KnownFormatError, applyKnown, buildKnown, readKnownFile, writeKnownFile } from "./known.js";
import { ParserLoadError } from "./parsers/js.js";
import { summarize, type ReportContext } from "./report/context.js";
import { renderJson } from "./report/json.js";
import { renderRules } from "./report/rules.js";
import { renderSarif, toolVersion } from "./report/sarif.js";
import { renderText } from "./report/text.js";
import { scan } from "./scan.js";
import type { Lang } from "./types.js";

export interface CliIo {
  out: (s: string) => void;
  err: (s: string) => void;
}

const OPTIONS = {
  baseline: { type: "string" },
  format: { type: "string" },
  confidence: { type: "string" },
  exclude: { type: "string", multiple: true },
  known: { type: "string" },
  "write-known": { type: "string" },
  explain: { type: "boolean" },
  "exit-zero": { type: "boolean" },
  lang: { type: "string" },
  version: { type: "boolean", short: "v" },
  help: { type: "boolean", short: "h" },
} as const;

/** The language flag is needed before parseArgs runs so its errors can be localised too. */
function peekLangFlag(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--lang") return argv[i + 1];
    if (a.startsWith("--lang=")) return a.slice("--lang=".length);
  }
  return undefined;
}

export function helpText(lang: Lang): string {
  const row = (flags: string, key: MessageKey): string => `  ${flags.padEnd(32)}${t(lang, key)}`;
  return [
    t(lang, "help.desc"),
    "",
    `${t(lang, "help.usage")}:`,
    `  baseline-modernize [paths...] [options]     ${t(lang, "help.cmd.scan")}`,
    `  baseline-modernize rules [options]          ${t(lang, "help.cmd.rules")}`,
    "",
    `${t(lang, "help.options")}:`,
    row("--baseline <widely|newly|YYYY>", "opt.baseline"),
    row("--format <text|json|sarif>", "opt.format"),
    row("--confidence <all|certain>", "opt.confidence"),
    row("--exclude <prefix>", "opt.exclude"),
    row("--known <file>", "opt.known"),
    row("--write-known <file>", "opt.writeKnown"),
    row("--explain", "opt.explain"),
    row("--exit-zero", "opt.exitZero"),
    row("--lang <en|ko>", "opt.lang"),
    row("-v, --version", "opt.version"),
    row("-h, --help", "opt.help"),
    "",
    `${t(lang, "help.exitCodes")}:`,
    `  0  ${t(lang, "exit.0")}`,
    `  1  ${t(lang, "exit.1")}`,
    `  2  ${t(lang, "exit.2")}`,
    "",
    `${t(lang, "help.examples")}:`,
    "  baseline-modernize src",
    "  baseline-modernize src --baseline 2021 --explain",
    "  baseline-modernize . --format sarif --known .baseline-modernize-known.json",
    "",
  ].join("\n");
}

/** Run the CLI and return the exit code. Never calls process.exit, so tests can call it directly. */
export async function main(argv: string[], env: NodeJS.ProcessEnv, cwd: string, io: CliIo): Promise<number> {
  const earlyFlag = peekLangFlag(argv);
  let lang = resolveLang(earlyFlag, env);
  const fail = (key: MessageKey, params: Record<string, string | number> = {}): number => {
    io.err(t(lang, key, params) + "\n");
    return 2;
  };

  let values: ReturnType<typeof parseArgs<{ options: typeof OPTIONS; allowPositionals: true }>>["values"];
  let positionals: string[];
  try {
    const parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
    values = parsed.values;
    positionals = parsed.positionals;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as { code?: string }).code;
    const option = /'([^']+)'/.exec(msg)?.[1] ?? msg;
    if (code === "ERR_PARSE_ARGS_UNKNOWN_OPTION") return fail("err.unknownOption", { option });
    if (code === "ERR_PARSE_ARGS_INVALID_OPTION_VALUE") return fail("err.missingValue", { option: option.split(" ")[0] ?? option });
    return fail("err.unexpected", { detail: msg });
  }

  if (values.lang !== undefined) {
    if (!isLang(values.lang)) return fail("err.badLang", { value: values.lang });
    lang = values.lang;
  }

  if (values.help) {
    io.out(helpText(lang));
    return 0;
  }
  if (values.version) {
    io.out(t(lang, "out.version", { tool: toolVersion(), data: loadData().webFeaturesVersion }) + "\n");
    return 0;
  }

  const format = values.format ?? "text";
  if (format !== "text" && format !== "json" && format !== "sarif") return fail("err.badFormat", { value: format });
  const confidence = values.confidence ?? "all";
  if (confidence !== "all" && confidence !== "certain") return fail("err.badConfidence", { value: confidence });

  let target: Target;
  try {
    target = parseTarget(values.baseline ?? "widely");
  } catch (err) {
    if (err instanceof InvalidTargetError) {
      return fail("err.badBaseline", { value: err.value, first: FIRST_BASELINE_YEAR, last: new Date().getFullYear() });
    }
    throw err;
  }

  const dataVersion = loadData().webFeaturesVersion;

  if (positionals[0] === "rules") {
    io.out(renderRules(lang, target));
    return 0;
  }

  try {
    const result = await scan({
      paths: positionals.length > 0 ? positionals : ["."],
      cwd,
      target,
      lang,
      exclude: values.exclude ?? [],
      confidence,
    });

    let usedKnown = false;
    if (values.known !== undefined && values["write-known"] === undefined) {
      try {
        applyKnown(result.findings, readKnownFile(resolve(cwd, values.known)));
        usedKnown = true;
      } catch (err) {
        if (err instanceof KnownFormatError) return fail("err.knownFormat", { file: values.known });
        return fail("err.knownRead", { file: values.known, detail: errCode(err) });
      }
    }

    if (values["write-known"] !== undefined) {
      const file = values["write-known"];
      const known = buildKnown(result.findings);
      try {
        writeKnownFile(resolve(cwd, file), known);
      } catch (err) {
        return fail("err.writeFail", { file, detail: errCode(err) });
      }
      const note = t(lang, "out.wroteKnown", { count: known.entries.length, file }) + "\n";
      (format === "text" ? io.out : io.err)(note);
      return 0;
    }

    const ctx: ReportContext = {
      lang,
      baseline: targetLabel(target),
      webFeatures: dataVersion,
      usedKnown,
      explain: values.explain === true,
      result,
    };
    io.out(format === "json" ? renderJson(ctx) : format === "sarif" ? renderSarif(ctx) : renderText(ctx));
    const fresh = summarize(result).new;
    return fresh > 0 && !values["exit-zero"] ? 1 : 0;
  } catch (err) {
    if (err instanceof PathNotFoundError) return fail("err.pathNotFound", { path: err.path });
    if (err instanceof ParserLoadError) return fail("err.parserLoad", { detail: err.message });
    return fail("err.unexpected", { detail: err instanceof Error ? err.message : String(err) });
  }
}

function errCode(err: unknown): string {
  return (err as { code?: string }).code ?? (err instanceof Error ? err.message : String(err));
}

// Run only when executed as a script (also through the npm bin symlink), not when imported by tests.
const entry = process.argv[1];
if (entry && fileURLToPath(import.meta.url) === realpathSync(entry)) {
  process.exitCode = await main(process.argv.slice(2), process.env, process.cwd(), {
    out: (s) => process.stdout.write(s),
    err: (s) => process.stderr.write(s),
  });
}
