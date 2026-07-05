import { describe, expect, test } from "bun:test";
import { isExaminerDemoMode } from "../parse-examiner-demo-mode";

describe("isExaminerDemoMode", () => {
  test("gjenkjenner exam", () => {
    expect(isExaminerDemoMode("exam")).toBe(true);
    expect(isExaminerDemoMode(" EXAM ")).toBe(true);
  });

  test("avviser andre demo-verdier", () => {
    expect(isExaminerDemoMode(undefined)).toBe(false);
    expect(isExaminerDemoMode("")).toBe(false);
    expect(isExaminerDemoMode("token123")).toBe(false);
  });
});
