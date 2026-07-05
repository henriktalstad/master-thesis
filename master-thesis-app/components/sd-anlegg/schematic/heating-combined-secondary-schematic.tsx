"use client";

import type { HeatingCombinedBranch, HeatingProcessSlot } from "@/lib/sd-anlegg/heating-process-presentation";
import { HeatingCombinedSlotCell } from "./heating-combined-branch-diagram";
import {
  HeatingCombinedEquipmentButton,
  HeatingCombinedGhostPressureSlot,
} from "./heating-combined-equipment-button";
import { HEATING_COMBINED_LAYOUT as styles } from "./styles/heating-combined-styles";
import { cn } from "@/lib/utils";

type BranchSecondaryProps = {
  branch: HeatingCombinedBranch;
  selectedKeys: Set<string>;
  onActivateSlot?: (slot: HeatingProcessSlot) => void;
};

function BranchSecondarySupplyLane({
  branch,
  selectedKeys,
  onActivateSlot,
}: BranchSecondaryProps) {
  return (
    <>
      <HeatingCombinedSlotCell col={1}>
        <HeatingCombinedEquipmentButton
          slot={branch.valve}
          selectedKeys={selectedKeys}
          onActivate={onActivateSlot}
        />
      </HeatingCombinedSlotCell>
      <HeatingCombinedSlotCell col={2}>
        <HeatingCombinedEquipmentButton
          slot={branch.pump1}
          selectedKeys={selectedKeys}
          onActivate={onActivateSlot}
        />
      </HeatingCombinedSlotCell>
      <HeatingCombinedSlotCell col={3}>
        <HeatingCombinedEquipmentButton
          slot={branch.pump2}
          selectedKeys={selectedKeys}
          onActivate={onActivateSlot}
        />
      </HeatingCombinedSlotCell>
      <HeatingCombinedSlotCell col={4}>
        <HeatingCombinedEquipmentButton
          slot={branch.supplyTemp}
          selectedKeys={selectedKeys}
          onActivate={onActivateSlot}
        />
      </HeatingCombinedSlotCell>
    </>
  );
}

function BranchSecondaryBridgeLane({
  branch,
  selectedKeys,
  onActivateSlot,
}: BranchSecondaryProps) {
  return (
    <HeatingCombinedSlotCell col={4}>
      {branch.pressure ? (
        <HeatingCombinedEquipmentButton
          slot={branch.pressure}
          selectedKeys={selectedKeys}
          onActivate={onActivateSlot}
        />
      ) : (
        <HeatingCombinedGhostPressureSlot />
      )}
    </HeatingCombinedSlotCell>
  );
}

function BranchSecondaryReturnLane({
  branch,
  selectedKeys,
  onActivateSlot,
}: BranchSecondaryProps) {
  return (
    <HeatingCombinedSlotCell col={4}>
      <HeatingCombinedEquipmentButton
        slot={branch.returnTemp}
        selectedKeys={selectedKeys}
        onActivate={onActivateSlot}
      />
    </HeatingCombinedSlotCell>
  );
}

/** Sekundær tur/retur-skisse — data-drevet, uten JSX-props. */
export function HeatingCombinedBranchSecondarySchematic({
  branch,
  selectedKeys,
  onActivateSlot,
}: BranchSecondaryProps) {
  const laneProps = { branch, selectedKeys, onActivateSlot };

  return (
    <div className={styles.secondarySchematic}>
      <div className={styles.secondaryRow}>
        <span className={cn(styles.laneLabel, styles.laneLabelSupply)}>Tur</span>
        <div className={cn(styles.laneTrackWrap, styles.laneTrackWrapSupply)}>
          <div className={cn(styles.laneTrack, styles.laneTrackSupply)} aria-hidden />
          <div className={cn(styles.laneGrid, styles.laneGridSupply)}>
            <BranchSecondarySupplyLane {...laneProps} />
          </div>
        </div>
      </div>

      <div className={styles.secondaryRow}>
        <span className={styles.bridgeSpacer} aria-hidden />
        <div className={cn(styles.laneGrid, styles.laneGridBridge)}>
          <BranchSecondaryBridgeLane {...laneProps} />
        </div>
      </div>

      <div className={styles.secondaryRow}>
        <span className={cn(styles.laneLabel, styles.laneLabelReturn)}>Retur</span>
        <div className={cn(styles.laneTrackWrap, styles.laneTrackWrapReturn)}>
          <div className={cn(styles.laneTrack, styles.laneTrackReturn)} aria-hidden />
          <div className={cn(styles.laneGrid, styles.laneGridReturn)}>
            <BranchSecondaryReturnLane {...laneProps} />
          </div>
        </div>
      </div>
    </div>
  );
}
