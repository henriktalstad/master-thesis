"use client";

import { cn } from "@/lib/utils";
import type {
  HeatingProcessSlot,
  TapWaterPresentationModel,
} from "@/lib/sd-anlegg/heating-process-presentation";
import { HeatingCombinedSlotCell } from "./heating-combined-branch-diagram";
import { HeatingCombinedTapSchematic } from "./heating-combined-tap-schematic";
import { HeatingExpansionTankSymbol } from "./heating-process-symbols";
import { TapWaterFlowSlot } from "./tap-water-flow-slot";
import { HEATING_COMBINED_LAYOUT as styles } from "./styles/heating-combined-styles";

type Props = {
  model: TapWaterPresentationModel;
  selectedKeys: Set<string>;
  onActivate?: (slot: HeatingProcessSlot) => void;
  className?: string;
  variant?: "full" | "compact";
};

export function TapWaterFlowSchematicFromModel({
  model,
  selectedKeys,
  onActivate,
  className,
  variant = "full",
}: Props) {
  const slotProps = { selectedKeys, onActivate };

  return (
    <div
      className={cn(
        styles.branchContainer,
        styles.tapFlowScroll,
        variant === "compact" && styles.tapFlowCompact,
        className,
      )}
    >
      <HeatingCombinedTapSchematic>
        <div className={styles.tapSource}>
          <span className="font-semibold uppercase tracking-wide text-muted-foreground">
            Fra
          </span>
          <span className="font-medium text-foreground">320.001</span>
          <span className="text-[0.92em] text-muted-foreground">SB501</span>
        </div>

        <HeatingCombinedSlotCell col={2}>
          <TapWaterFlowSlot slot={model.valve} {...slotProps} />
        </HeatingCombinedSlotCell>

        <HeatingCombinedSlotCell col={3}>
          <div className={styles.tapTank}>
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">
              LV001
            </span>
            <HeatingExpansionTankSymbol className="h-[2.35rem] w-[1.35rem] shrink-0 opacity-95" />
            <span className="text-[0.68em] font-medium text-muted-foreground">
              Utjevning
            </span>
          </div>
        </HeatingCombinedSlotCell>

        <HeatingCombinedSlotCell col={4}>
          <TapWaterFlowSlot slot={model.supplyTemp} {...slotProps} />
        </HeatingCombinedSlotCell>

        <HeatingCombinedSlotCell col={5}>
          <TapWaterFlowSlot slot={model.pump} {...slotProps} />
        </HeatingCombinedSlotCell>

        <HeatingCombinedSlotCell col={6}>
          <div className={styles.tapOutflow}>
            <span className="font-semibold uppercase tracking-wide text-muted-foreground">
              Til
            </span>
            <span className="font-medium text-foreground">Forbruk</span>
          </div>
        </HeatingCombinedSlotCell>
      </HeatingCombinedTapSchematic>
    </div>
  );
}
