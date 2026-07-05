import { describe, expect, it } from "bun:test";
import { buildMpcArchitectureDiagram } from "../build-mpc-architecture-diagram";

describe("buildMpcArchitectureDiagram", () => {
  it("routes simulated MPC to evaluation only (no BMS writeback edge)", () => {
    const diagram = buildMpcArchitectureDiagram();
    const ids = new Set(diagram.nodes.map((n) => n.id));

    expect(ids.has("optimizer")).toBe(true);
    expect(ids.has("plant")).toBe(true);
    expect(ids.has("projection")).toBe(true);
    expect(ids.has("estimator")).toBe(true);

    const measFeedback = diagram.edges.find(
      (e) => e.from === "database" && e.to === "estimator",
    );
    expect(measFeedback?.label).toBe("Måling");

    const toBms = diagram.edges.find(
      (e) => e.from === "projection" && e.to === "local_bms",
    );
    expect(toBms).toBeUndefined();

    const toEval = diagram.edges.find(
      (e) => e.from === "projection" && e.to === "compare",
    );
    expect(toEval?.dashed).toBe(true);
  });

  it("groups match thesis architecture sections", () => {
    const diagram = buildMpcArchitectureDiagram();
    const groupIds = diagram.groups.map((g) => g.id);

    expect(groupIds).toEqual([
      "inputs",
      "constraints",
      "mpc",
      "legacy",
      "evaluation",
    ]);
  });
});
