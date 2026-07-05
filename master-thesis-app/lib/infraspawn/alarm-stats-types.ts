export type InfraspawnAlarmStatsPeriod = 7 | 30 | 90;

export type InfraspawnAlarmStats = {
  periodDays: InfraspawnAlarmStatsPeriod;
  from: string;
  to: string;
  totalCount: number;
  byType: Array<{
    typeKey: string;
    label: string;
    count: number;
  }>;
  dailyBuckets: Array<{ day: string; count: number }>;
};
