import { afterEach, describe, expect, it } from "bun:test";

const envBackup = { ...process.env };

afterEach(() => {
  process.env = { ...envBackup };
});

describe("mpc-automation", () => {
  it("auto-run er på som standard", async () => {
    delete process.env.MPC_AUTO_RUN;
    const { isMpcAutoRunEnabled } = await import("../mpc-automation");
    expect(isMpcAutoRunEnabled()).toBe(true);
  });

  it("auto-run kan skrus av med 0", async () => {
    process.env.MPC_AUTO_RUN = "0";
    const { isMpcAutoRunEnabled } = await import("../mpc-automation");
    expect(isMpcAutoRunEnabled()).toBe(false);
  });

  it("auto-ensure er på som standard", async () => {
    delete process.env.MPC_AUTO_ENSURE;
    const { isMpcAutoEnsureEnabled } = await import("../mpc-automation");
    expect(isMpcAutoEnsureEnabled()).toBe(true);
  });
});
