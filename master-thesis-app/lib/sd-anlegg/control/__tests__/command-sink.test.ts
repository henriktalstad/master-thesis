import { afterEach, describe, expect, it, mock } from "bun:test";

mock.module("server-only", () => ({}));

const sampleCommand = {
  buildingId: "b1",
  pipelineRunId: "run1",
  policyId: "mpc-v1" as const,
  stepAt: new Date("2026-06-30T12:00:00Z"),
  kind: "control_tick" as const,
  uProposed: {
    supplySetpointC: 18,
    supplyFanPct: 40,
    exhaustFanPct: 35,
    heatingValvePct: 0,
    coolingValvePct: 0,
  },
  status: "approved",
};

class MemorySink {
  readonly written: unknown[] = [];

  async writeProposed(commands: readonly unknown[]): Promise<void> {
    this.written.push(...commands);
  }
}

describe("buildReplayProposedCommands", () => {
  it("persisterer observert, emulert, demand og mpc per steg", async () => {
    const { buildReplayProposedCommands } = await import(
      "@/lib/sd-anlegg/control/command-sink"
    );
    const u = {
      supplySetpointC: 18,
      supplyFanPct: 40,
      exhaustFanPct: 35,
      heatingValvePct: 10,
      coolingValvePct: 0,
    };
    const commands = buildReplayProposedCommands({
      buildingId: "b1",
      pipelineRunId: "run1",
      steps: [
        {
          t: "2026-06-30T12:00:00.000Z",
          uBmsMeas: u,
          uBmsSim: { ...u, supplyFanPct: 38 },
          uDemand: { ...u, supplyFanPct: 36 },
          uMpc: { ...u, supplyFanPct: 32 },
        } as never,
      ],
    });
    expect(commands.map((c) => c.policyId)).toEqual([
      "observed",
      "emulated",
      "demand-scoped",
      "mpc-v1",
    ]);
    expect(commands.every((c) => c.kind === "replay_step")).toBe(true);
    expect(commands.every((c) => c.pipelineRunId === "run1")).toBe(true);
  });
});

describe("isMpcMqttWritebackEnabled", () => {
  afterEach(() => {
    delete process.env.MPC_MQTT_WRITEBACK;
  });

  it("returnerer false uten env", async () => {
    const { isMpcMqttWritebackEnabled } = await import(
      "@/lib/sd-anlegg/control/command-sink"
    );
    expect(isMpcMqttWritebackEnabled()).toBe(false);
  });

  it("returnerer true når MPC_MQTT_WRITEBACK=1", async () => {
    process.env.MPC_MQTT_WRITEBACK = "1";
    const { isMpcMqttWritebackEnabled } = await import(
      "@/lib/sd-anlegg/control/command-sink"
    );
    expect(isMpcMqttWritebackEnabled()).toBe(true);
  });
});

describe("CompositeCommandSink", () => {
  it("skriver til alle sinks", async () => {
    const { CompositeCommandSink } = await import("@/lib/sd-anlegg/control/command-sink");
    const a = new MemorySink();
    const b = new MemorySink();
    const composite = new CompositeCommandSink([a, b]);
    await composite.writeProposed([sampleCommand]);
    expect(a.written).toHaveLength(1);
    expect(b.written).toHaveLength(1);
  });
});

describe("MqttCommandSink", () => {
  it("kaster ikke ved dry-run", async () => {
    const { MqttCommandSink } = await import("@/lib/sd-anlegg/control/command-sink");
    const sink = new MqttCommandSink();
    await expect(sink.writeProposed([sampleCommand])).resolves.toBeUndefined();
  });
});

describe("resolveCommandSink", () => {
  afterEach(() => {
    delete process.env.MPC_MQTT_WRITEBACK;
  });

  it("returnerer kun db-sink som standard", async () => {
    const { resolveCommandSink } = await import(
      "@/lib/sd-anlegg/control/db-command-sink"
    );
    const db = new MemorySink();
    const sink = resolveCommandSink({ db });
    expect(sink).toBe(db);
  });

  it("returnerer composite når mqtt er aktivert", async () => {
    process.env.MPC_MQTT_WRITEBACK = "1";
    const { resolveCommandSink } = await import(
      "@/lib/sd-anlegg/control/db-command-sink"
    );
    const { CompositeCommandSink } = await import(
      "@/lib/sd-anlegg/control/command-sink"
    );
    const db = new MemorySink();
    const mqtt = new MemorySink();
    const sink = resolveCommandSink({ db, mqtt });
    expect(sink).toBeInstanceOf(CompositeCommandSink);
  });
});
