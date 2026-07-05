"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { HEATING_COMBINED_LAYOUT as styles } from "./styles/heating-combined-styles";

export function HeatingCombinedTapSchematic({ children }: { children: ReactNode }) {
  return (
    <div className={styles.secondarySchematic}>
      <div className={styles.secondaryRow}>
        <span className={cn(styles.laneLabel, styles.laneLabelSupply)}>Tur</span>
        <div className={cn(styles.laneTrackWrap, styles.laneTrackWrapSupply)}>
          <div className={cn(styles.laneTrack, styles.laneTrackSupply)} aria-hidden />
          <div className={cn(styles.tapGrid, styles.laneGridSupply)}>{children}</div>
        </div>
      </div>
    </div>
  );
}
