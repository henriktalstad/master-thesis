import { describe, expect, it } from "bun:test";
import { infraspawnAlarmOpenDedupeKey } from "../alarm-open-dedupe-key";

describe("infraspawnAlarmOpenDedupeKey", () => {
  it("bygger stabil nøkkel per kilde, punkt og kind", () => {
    expect(
      infraspawnAlarmOpenDedupeKey("src1", "AV-1", "ALARM"),
    ).toBe("src1:AV-1:ALARM");
    expect(
      infraspawnAlarmOpenDedupeKey("src1", "AV-1", "FAULT"),
    ).toBe("src1:AV-1:FAULT");
  });
});
