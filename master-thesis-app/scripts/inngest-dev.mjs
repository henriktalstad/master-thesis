#!/usr/bin/env node
/**
 * Starter Inngest Dev Server for lokal utvikling.
 * Krever INNGEST_DEV=1 på Next.js-appen (settes av dev:pipeline).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const localBin = resolve(root, "node_modules/.bin/inngest");
const port = process.env.PORT?.trim() || "3000";
const appUrl =
  process.env.INNGEST_DEV_APP_URL?.trim() ||
  `http://localhost:${port}/api/inngest`;

const args = [
  "dev",
  "--queue-workers",
  "50",
  "-u",
  appUrl,
  "--no-discovery",
];

const cmd = existsSync(localBin) ? localBin : "npx";
const cmdArgs = existsSync(localBin)
  ? args
  : ["--ignore-scripts=false", "inngest-cli@latest", ...args];

const proc = spawn(cmd, cmdArgs, {
  cwd: root,
  stdio: "inherit",
  shell: false,
});

proc.on("exit", (code) => {
  process.exit(code ?? 0);
});

proc.on("error", (err) => {
  console.error("[inngest:dev] kunne ikke starte:", err);
  process.exit(1);
});
