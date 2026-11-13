import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Project root: dist/test/ -> ../../ */
export const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const CLI = join(ROOT, "dist", "cli.js");

export function tempDir(prefix = "bm-"): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export function writeFiles(dir: string, files: Record<string, string>): void {
  for (const [name, content] of Object.entries(files)) {
    const full = join(dir, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
}

export interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Run the built CLI in a child process with a pinned locale so the host's
 * LANG never changes the output. Pass `env` to override the pinned values.
 */
export function runCli(args: string[], opts: { cwd?: string; env?: Record<string, string> } = {}): RunResult {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const k of ["BASELINE_MODERNIZE_LANG", "LC_ALL", "LC_MESSAGES", "LANG"]) delete env[k];
  env.LANG = "en_US.UTF-8";
  Object.assign(env, opts.env ?? {});
  const res = spawnSync(process.execPath, [CLI, ...args], { cwd: opts.cwd ?? ROOT, env, encoding: "utf8" });
  return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}
