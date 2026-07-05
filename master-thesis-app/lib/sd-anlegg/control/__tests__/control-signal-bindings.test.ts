import { describe, expect, test } from "bun:test";
import {
  controlSignalBindingKey,
  findControlSignalBinding,
  mergeControlSignalBindings,
  parseControlSignalBindings,
} from "@/lib/sd-anlegg/control/control-signal-bindings";

describe("control-signal-bindings", () => {
  test("parseControlSignalBindings deduperer på canonical+unit", () => {
    const parsed = parseControlSignalBindings([
      {
        sourceId: "src-1",
        objectId: "AO-1",
        canonicalId: "supply.setpoint",
        unitKey: "360102",
        source: "manual",
        confidence: "high",
      },
      {
        sourceId: "src-1",
        objectId: "AO-2",
        canonicalId: "supply.setpoint",
        unitKey: "360102",
        source: "bootstrap",
        confidence: "low",
      },
    ]);

    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.objectId).toBe("AO-1");
  });

  test("findControlSignalBinding foretrekker unit-spesifikk binding", () => {
    const bindings = parseControlSignalBindings([
      {
        sourceId: "src-1",
        objectId: "AO-global",
        canonicalId: "supply.fan.command",
        source: "pattern",
        confidence: "medium",
      },
      {
        sourceId: "src-1",
        objectId: "AO-scoped",
        canonicalId: "supply.fan.command",
        unitKey: "360102",
        source: "manual",
        confidence: "high",
      },
    ]);

    const match = findControlSignalBinding({
      bindings,
      sourceId: "src-1",
      canonicalId: "supply.fan.command",
      unitKey: "360102",
    });

    expect(match?.objectId).toBe("AO-scoped");
  });

  test("mergeControlSignalBindings beholder høyere kilde-rang", () => {
    const merged = mergeControlSignalBindings(
      parseControlSignalBindings([
        {
          sourceId: "src-1",
          objectId: "AO-bootstrap",
          canonicalId: "exhaust.fan.command",
          unitKey: "360102",
          source: "bootstrap",
          confidence: "medium",
        },
      ]),
      parseControlSignalBindings([
        {
          sourceId: "src-1",
          objectId: "AO-manual",
          canonicalId: "exhaust.fan.command",
          unitKey: "360102",
          source: "manual",
          confidence: "high",
        },
      ]),
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]?.objectId).toBe("AO-manual");
    expect(controlSignalBindingKey(merged[0]!)).toBe("src-1:360102:exhaust.fan.command");
  });
});
