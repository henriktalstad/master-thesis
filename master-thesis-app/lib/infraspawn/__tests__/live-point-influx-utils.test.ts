import { describe, expect, test } from "bun:test";
import {
  chunkInfluxObjectIds,
  fetchInfluxLatestRowsByObjectIdChunks,
  latestInfluxRowByObjectId,
  objectIdsNeedingSelectorFallback,
  resolveInfluxTailCandidates,
} from "@/lib/infraspawn/live-point-influx-utils";
import type { InfraspawnBacnetRow } from "@/lib/infraspawn/types";

function row(
  objectId: string,
  sampledAt: string,
  valueNum: number | null,
): InfraspawnBacnetRow {
  return {
    objectId,
    sampledAt: new Date(sampledAt),
    valueNum,
    unit: null,
    quality: null,
  };
}

describe("chunkInfluxObjectIds", () => {
  test("deler objectId i jevne chunker", () => {
    const ids = Array.from({ length: 95 }, (_, index) => `id-${index}`);
    const chunks = chunkInfluxObjectIds(ids, 40);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toHaveLength(40);
    expect(chunks[2]).toHaveLength(15);
  });
});

describe("latestInfluxRowByObjectId", () => {
  test("beholder nyeste rad per objectId", () => {
    const latest = latestInfluxRowByObjectId([
      row("a", "2026-06-20T11:00:00.000Z", 1),
      row("a", "2026-06-20T11:15:00.000Z", 2),
      row("b", "2026-06-20T11:10:00.000Z", 3),
    ]);

    expect(latest.get("a")?.valueNum).toBe(2);
    expect(latest.get("b")?.valueNum).toBe(3);
  });
});

describe("resolveInfluxTailCandidates", () => {
  test("undefined tailObjectIds gir ingen tail", () => {
    expect(
      resolveInfluxTailCandidates({
        tailObjectIds: undefined,
        foundObjectIds: new Set(["a"]),
      }),
    ).toEqual([]);
  });

  test("tom tailObjectIds gir ingen tail", () => {
    expect(
      resolveInfluxTailCandidates({
        tailObjectIds: [],
        foundObjectIds: new Set(),
      }),
    ).toEqual([]);
  });

  test("filtrerer bort ids som allerede har stream-treff", () => {
    expect(
      resolveInfluxTailCandidates({
        tailObjectIds: ["a", "b", "c"],
        foundObjectIds: new Set(["b"]),
      }),
    ).toEqual(["a", "c"]);
  });
});

describe("objectIdsNeedingSelectorFallback", () => {
  test("null-verdi kun når chunk hadde andre treff", () => {
    const missing = objectIdsNeedingSelectorFallback([
      {
        objectIds: ["a", "b", "c"],
        rows: [row("a", "2026-06-20T11:00:00.000Z", 1)],
        failed: false,
      },
      {
        objectIds: ["d", "e"],
        rows: [],
        failed: false,
      },
    ]);

    expect(missing).toEqual(["b", "c"]);
  });

  test("kun feilet chunk, ikke tom chunk uten data", () => {
    expect(objectIdsNeedingSelectorFallback([
      {
        objectIds: ["a", "b"],
        rows: [],
        failed: true,
      },
      {
        objectIds: ["c", "d"],
        rows: [],
        failed: false,
      },
    ])).toEqual(["a", "b"]);
  });

  test("kombinerer null-verdi og feilet chunk", () => {
    expect(objectIdsNeedingSelectorFallback([
      {
        objectIds: ["a", "b"],
        rows: [row("a", "2026-06-20T11:00:00.000Z", null)],
        failed: false,
      },
      {
        objectIds: ["c"],
        rows: [],
        failed: true,
      },
    ])).toEqual(["b", "c"]);
  });
});

describe("fetchInfluxLatestRowsByObjectIdChunks", () => {
  test("reduserer til nyeste per objectId per chunk", async () => {
    const chunkCalls: string[][] = [];
    const { rows, chunks } = await fetchInfluxLatestRowsByObjectIdChunks(
      ["a", "b", "c"],
      async (objectIds) => {
        chunkCalls.push(objectIds);
        return [
          row("a", "2026-06-20T11:00:00.000Z", 1),
          row("a", "2026-06-20T11:15:00.000Z", 2),
          row("b", "2026-06-20T11:10:00.000Z", 3),
          row("c", "2026-06-20T11:12:00.000Z", 4),
        ].filter((entry) => objectIds.includes(entry.objectId));
      },
      { chunkSize: 2, parallelChunks: 2 },
    );

    expect(chunkCalls).toEqual([["a", "b"], ["c"]]);
    expect(rows).toHaveLength(3);
    expect(chunks).toHaveLength(2);
    expect(rows.find((entry) => entry.objectId === "a")?.valueNum).toBe(2);
  });

  test("markerer feilet chunk uten å stoppe resten", async () => {
    const { rows, chunks } = await fetchInfluxLatestRowsByObjectIdChunks(
      ["a", "b", "c"],
      async (objectIds) => {
        if (objectIds.includes("b")) {
          throw new Error("influx timeout");
        }
        return [row(objectIds[0]!, "2026-06-20T11:00:00.000Z", 1)];
      },
      { chunkSize: 2, parallelChunks: 2 },
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.objectId).toBe("c");
    expect(chunks.some((chunk) => chunk.failed && chunk.objectIds.includes("b"))).toBe(
      true,
    );
  });
});
