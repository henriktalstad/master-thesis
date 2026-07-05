import { describe, expect, it } from "bun:test";
import {
  chunkRows,
  INFRASPAWN_SAMPLE_BATCH_SIZE,
} from "@/lib/infraspawn/chunk-rows";

describe("chunkRows", () => {
  it("returnerer tom liste for tom input", () => {
    expect(chunkRows([], 100)).toEqual([]);
  });

  it("beholder én chunk når antall <= størrelse", () => {
    const rows = [1, 2, 3];
    expect(chunkRows(rows, INFRASPAWN_SAMPLE_BATCH_SIZE)).toEqual([rows]);
  });

  it("deler jevnt i flere chunks", () => {
    const rows = Array.from({ length: 5 }, (_, i) => i);
    expect(chunkRows(rows, 2)).toEqual([[0, 1], [2, 3], [4]]);
  });

  it("bruker INFRASPAWN_SAMPLE_BATCH_SIZE som standard chunk-størrelse i sync", () => {
    expect(INFRASPAWN_SAMPLE_BATCH_SIZE).toBe(400);
    const rows = Array.from({ length: 801 }, (_, i) => i);
    const chunks = chunkRows(rows, INFRASPAWN_SAMPLE_BATCH_SIZE);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(400);
    expect(chunks[1]).toHaveLength(400);
    expect(chunks[2]).toHaveLength(1);
  });

  it("kaster ved ugyldig chunk-størrelse", () => {
    expect(() => chunkRows([1], 0)).toThrow("chunk size must be positive");
  });
});
