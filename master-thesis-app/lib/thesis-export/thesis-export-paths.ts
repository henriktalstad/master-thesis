import { resolve } from "node:path";

/** Canonical thesis snapshot (LaTeX / validate_results). */
export function resolveThesisProcessedDir(cwd = process.cwd()): string {
  return resolve(cwd, "../data/processed");
}

/** UI / run-scoped exports — never overwrite submission snapshot. */
export function resolveThesisExportOutDir(options?: {
  outDir?: string;
  exportRunId?: string;
  cwd?: string;
}): string {
  if (options?.outDir) return options.outDir;
  const cwd = options?.cwd ?? process.cwd();
  if (options?.exportRunId) {
    return resolve(cwd, "../data/exports", options.exportRunId);
  }
  return resolveThesisProcessedDir(cwd);
}
