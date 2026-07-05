import { prisma } from "@/lib/db";

/** Alarmer som utløser Methods eq:method_mpc_fallback (frost/brann/røyk/kritisk). */
export function isMpcSafetyFallbackAlarm(event: {
  severity: string;
  domain: string | null;
  alarmText: string;
}): boolean {
  if (event.severity === "A" || event.severity === "FAULT") return true;
  const text = event.alarmText.toLowerCase();
  return (
    text.includes("frost") ||
    text.includes("brann") ||
    text.includes("røyk") ||
    text.includes("roeyk") ||
    text.includes("fire") ||
    text.includes("smoke")
  );
}

export async function loadMpcAlarmActiveSteps(input: {
  buildingId: string;
  evalStart: Date;
  evalEnd: Date;
  grid: readonly string[];
}): Promise<Set<string>> {
  if (input.grid.length === 0) return new Set();

  const events = await prisma.infraspawnAlarmEvent.findMany({
    where: {
      buildingId: input.buildingId,
      kind: "ALARM",
      activatedAt: { lte: input.evalEnd },
      OR: [{ clearedAt: null }, { clearedAt: { gt: input.evalStart } }],
    },
    select: {
      activatedAt: true,
      clearedAt: true,
      severity: true,
      domain: true,
      alarmText: true,
    },
  });

  const safetyEvents = events.filter(isMpcSafetyFallbackAlarm);
  if (safetyEvents.length === 0) return new Set();

  const activeSteps = new Set<string>();
  for (const step of input.grid) {
    const tMs = new Date(step).getTime();
    const active = safetyEvents.some(
      (event) =>
        event.activatedAt.getTime() <= tMs &&
        (event.clearedAt == null || event.clearedAt.getTime() > tMs),
    );
    if (active) activeSteps.add(step);
  }
  return activeSteps;
}
