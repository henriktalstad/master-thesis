import { describe, expect, it } from "bun:test";
import { InfraspawnAlarmKind } from "@/generated/client/enums";
import { infraspawnAlarmOpenDedupeKey } from "../alarm-open-dedupe-key";

describe("infraspawnAlarmOpenDedupeKey", () => {
  it("inkluderer source, object og kind", () => {
    expect(
      infraspawnAlarmOpenDedupeKey("src-1", "obj-2", InfraspawnAlarmKind.ALARM),
    ).toBe("src-1:obj-2:ALARM");
  });

  it("skiller kind", () => {
    const base = infraspawnAlarmOpenDedupeKey(
      "src",
      "obj",
      InfraspawnAlarmKind.ALARM,
    );
    const fault = infraspawnAlarmOpenDedupeKey(
      "src",
      "obj",
      InfraspawnAlarmKind.FAULT,
    );
    expect(base).not.toBe(fault);
  });
});
