#!/usr/bin/env bun
/** Dev + Inngest dev server. */

import { spawn } from "node:child_process";
import { resolve } from "node:path";

const cwd = resolve(import.meta.dir, "..");
const port = process.env.PORT?.trim() || "3000";
const appUrl =
  process.env.INNGEST_DEV_APP_URL?.trim() ||
  `http://localhost:${port}/api/inngest`;

const devEnv: NodeJS.ProcessEnv = {
  ...process.env,
  INNGEST_DEV: "1",
  INNGEST_DEV_APP_URL: appUrl,
};

function spawnLogged(name: string, cmd: string, args: string[]) {
  const child = spawn(cmd, args, {
    cwd,
    env: devEnv,
    stdio: "inherit",
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[dev:pipeline] ${name} stoppet (${signal})`);
      return;
    }
    if (code && code !== 0) {
      console.error(`[dev:pipeline] ${name} avsluttet med kode ${code}`);
    }
  });

  return child;
}

const nextDev = spawnLogged("next", "bunx", ["--bun", "next", "dev"]);
const inngestDev = spawnLogged("inngest", "node", [
  resolve(import.meta.dir, "inngest-dev.mjs"),
]);

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[dev:pipeline] mottok ${signal}, stopper…`);
  inngestDev.kill("SIGTERM");
  nextDev.kill("SIGTERM");
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

nextDev.on("exit", (code) => {
  if (!shuttingDown) {
    inngestDev.kill("SIGTERM");
    process.exit(code ?? 0);
  }
});

inngestDev.on("exit", (code) => {
  if (!shuttingDown && code && code !== 0) {
    console.warn(
      "[dev:pipeline] Inngest dev stoppet — cron/simulering kjører ikke før den er oppe igjen",
    );
  }
});

console.log("[dev:pipeline] starter Next.js + Inngest dev …");
console.log(`[dev:pipeline] App: http://localhost:${port}`);
console.log(`[dev:pipeline] Inngest serve: ${appUrl}`);
console.log("[dev:pipeline] Inngest UI: http://localhost:8288 (eller neste ledige port)");
console.log("[dev:pipeline] MPC auto-run/ensure er på som standard (skru av med MPC_AUTO_*=0)");
console.log("[dev:pipeline] bruk Ctrl+C for å stoppe begge");
