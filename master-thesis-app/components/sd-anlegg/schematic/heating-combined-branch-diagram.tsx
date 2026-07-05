"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { HEATING_COMBINED_LAYOUT as styles } from "./styles/heating-combined-styles";

export function HeatingCombinedSlotCell({
  col,
  children,
}: {
  col?: 1 | 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
}) {
  const colClass =
    col === 1
      ? styles.col1
      : col === 2
        ? styles.col2
        : col === 3
          ? styles.col3
          : col === 4
            ? styles.col4
            : col === 5
              ? styles.col5
              : col === 6
                ? styles.col6
                : undefined;

  return (
    <div className={cn(styles.slotCell, colClass)}>
      <div className={styles.slotInner}>{children}</div>
    </div>
  );
}

export function HeatingCombinedBranchDiagramGrid({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary: ReactNode;
}) {
  return (
    <div className={styles.branchContainer}>
      <div className={styles.branchGrid}>
        <div className={styles.primaryColumn}>
          <span className={cn(styles.zoneLabel, styles.laneLabelSupply)}>Primær</span>
          <div className={styles.primaryContent}>{primary}</div>
        </div>
        <div className={styles.secondaryColumn}>
          <span className={cn(styles.zoneLabel, styles.laneLabelReturn)}>Sekundær</span>
          {secondary}
        </div>
      </div>
    </div>
  );
}
