/**
 * Bun preload: stub `server-only` for CLI-skript uten Next.js RSC-kontekst.
 */
import { mock } from "bun:test";

mock.module("server-only", () => ({}));
