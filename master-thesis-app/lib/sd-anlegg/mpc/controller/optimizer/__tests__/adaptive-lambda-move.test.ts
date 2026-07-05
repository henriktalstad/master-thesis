import { describe, expect, it } from "bun:test";
import {
  ADAPTIVE_LAMBDA_MOVE_MIN_SCALE,
  scaleAdaptiveLambdaMove,
} from "../solve-horizon";

describe("scaleAdaptiveLambdaMove", () => {
  it("holder minimum skaleringsgulv ved flat kost-gradient", () => {
    const lambdaMove = 0.015;
    const scaled = scaleAdaptiveLambdaMove(0.001, lambdaMove);
    expect(scaled).toBeCloseTo(lambdaMove * ADAPTIVE_LAMBDA_MOVE_MIN_SCALE, 6);
    expect(scaled).toBeGreaterThan(lambdaMove * 0.15);
  });

  it("bruker full λ_move ved høy gjennomsnittlig stegkost", () => {
    const lambdaMove = 0.015;
    expect(scaleAdaptiveLambdaMove(0.05, lambdaMove)).toBe(lambdaMove);
  });
});
