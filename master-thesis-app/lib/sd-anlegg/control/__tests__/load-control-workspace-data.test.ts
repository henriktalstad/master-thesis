import { mock, describe, expect, test } from "bun:test";

mock.module("server-only", () => ({}));

describe("loadSdAnleggControlWorkspaceData", () => {
  test("eksporterer cached loader (read-only page load)", async () => {
    const { loadSdAnleggControlWorkspaceData } = await import(
      "@/lib/sd-anlegg/control/load-control-workspace-data"
    );
    expect(typeof loadSdAnleggControlWorkspaceData).toBe("function");
  });
});
