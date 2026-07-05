"use client";

import { cn } from "@/lib/utils";
import type { SchematicAlarmItem } from "@/lib/sd-anlegg/ahu-schematic-alarm-indicators";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import {
  SD_ANLEGG_PROCESS_ALARM_INDICATOR_ACTIVE,
  SD_ANLEGG_PROCESS_ALARM_INDICATOR_IDLE,
  SD_ANLEGG_PROCESS_ALARM_LIST,
  SD_ANLEGG_PROCESS_ALARM_PANEL,
  SD_ANLEGG_PROCESS_ALARM_ROW,
  SD_ANLEGG_PROCESS_ALARM_ROW_BUTTON,
  SD_ANLEGG_PROCESS_ALARM_ROW_LABEL_ACTIVE,
  SD_ANLEGG_PROCESS_ALARM_ROW_LABEL_IDLE,
  SD_ANLEGG_PROCESS_ALARM_TITLE,
} from "./styles/process-schematic-styles";

function AlarmRow({
  label,
  active,
  onActivate,
}: {
  label: string;
  active: boolean;
  onActivate?: () => void;
}) {
  const indicatorClass = active
    ? SD_ANLEGG_PROCESS_ALARM_INDICATOR_ACTIVE
    : SD_ANLEGG_PROCESS_ALARM_INDICATOR_IDLE;
  const labelClass = active
    ? SD_ANLEGG_PROCESS_ALARM_ROW_LABEL_ACTIVE
    : SD_ANLEGG_PROCESS_ALARM_ROW_LABEL_IDLE;

  const content = (
    <>
      <span className={indicatorClass} aria-hidden />
      <span className={labelClass}>{label}</span>
    </>
  );

  if (!onActivate) {
    return <div className={SD_ANLEGG_PROCESS_ALARM_ROW}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={cn(SD_ANLEGG_PROCESS_ALARM_ROW_BUTTON, SD_ANLEGG_BTN_PRESS)}
      onClick={onActivate}
      aria-label={`Vis historikk for ${label}`}
    >
      {content}
    </button>
  );
}

type Props = {
  alarms: readonly SchematicAlarmItem[];
  lowEfficiencyActive?: boolean;
  onActivateAlarm?: (item: SchematicAlarmItem) => void;
  onActivateLowEfficiency?: () => void;
  className?: string;
};

export function ProcessSchematicSidePanel({
  alarms,
  lowEfficiencyActive = false,
  onActivateAlarm,
  onActivateLowEfficiency,
  className,
}: Props) {
  const visibleAlarms = alarms.filter((item) => item.id !== "sum_c");

  return (
    <aside className={cn(SD_ANLEGG_PROCESS_ALARM_PANEL, className)} aria-label="Alarmer">
      <p className={SD_ANLEGG_PROCESS_ALARM_TITLE}>Alarmer</p>
      <div className={SD_ANLEGG_PROCESS_ALARM_LIST}>
        {visibleAlarms.map((item) => (
          <AlarmRow
            key={item.id}
            label={item.label}
            active={item.active}
            onActivate={
              onActivateAlarm && item.point
                ? () => onActivateAlarm(item)
                : undefined
            }
          />
        ))}
        <AlarmRow
          label="Virkningsgrad lav"
          active={lowEfficiencyActive}
          onActivate={onActivateLowEfficiency}
        />
      </div>
    </aside>
  );
}
