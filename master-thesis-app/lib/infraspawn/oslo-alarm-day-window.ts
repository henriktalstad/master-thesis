import { addDaysToYmd, osloYmdFromDate, toUTCForOslo } from "@/lib/utils";
export function resolveOsloAlarmDayWindow(now: Date = new Date()): {
  start: Date;
  end: Date;
} {
  const todayYmd = osloYmdFromDate(now);
  return {
    start: new Date(toUTCForOslo(todayYmd, 0)),
    end: new Date(toUTCForOslo(addDaysToYmd(todayYmd, 1), 0)),
  };
}
