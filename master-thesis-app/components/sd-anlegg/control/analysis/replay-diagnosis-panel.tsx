"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MpcReplayResult } from "@/lib/sd-anlegg/mpc/shared/types";
import type { MpcReplayStep } from "@/lib/sd-anlegg/mpc/shared/types";
import { analyzeReplayCostDelta } from "@/lib/sd-anlegg/mpc/pipeline/analyze-replay-cost-delta";
import { CONTROL_EFFECT_UI } from "@/lib/sd-anlegg/control/control-display-labels";
import { SD_ANLEGG_INFO_BANNER } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  summary: MpcReplayResult["summary"];
  replaySteps: readonly MpcReplayStep[];
  className?: string;
};

function buildSmallSavingsNote(
  summary: MpcReplayResult["summary"],
): string | null {
  const delta = Math.abs(summary.deltaCostPct);
  const movePct =
    summary.mpcVsObservedDeltaPct ?? summary.meaningfulDeltaPct ?? 0;

  if (delta < 0.5 && movePct < 5) {
    return "Besparelsen er liten. Modellen dekker AHU og fjernvarmeventiler — ikke hele bygget.";
  }
  if (delta < 0.5) {
    return "Kostnadseffekten er liten selv om forslaget avviker fra målt drift — typisk når prisene varierer lite.";
  }
  return null;
}

export function SdAnleggControlReplayDiagnosisPanel({
  summary,
  replaySteps,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const diagnosis = useMemo(
    () =>
      replaySteps.length > 0
        ? analyzeReplayCostDelta({ steps: replaySteps, summary })
        : null,
    [replaySteps, summary],
  );

  if (!diagnosis) return null;

  const showDetails =
    diagnosis.explanations.length > 0 &&
    (Math.abs(summary.deltaCostPct) < 1 ||
      (summary.mpcVsObservedDeltaPct ?? summary.meaningfulDeltaPct ?? 0) < 10);
  const hasFagfolkDetails =
    showDetails ||
    (summary.fallbackPct != null && summary.fallbackPct > 0);
  const smallSavingsNote = buildSmallSavingsNote(summary);

  if (!smallSavingsNote && !hasFagfolkDetails) return null;

  return (
    <section
      className={cn(
        SD_ANLEGG_INFO_BANNER,
        "px-4 py-3 text-xs leading-relaxed sm:px-5",
        className,
      )}
      aria-label="Forklaring av resultat"
    >
      {smallSavingsNote ? (
        <p className="text-foreground">{smallSavingsNote}</p>
      ) : null}
      {hasFagfolkDetails ? (
        <div className={smallSavingsNote ? "mt-2" : undefined}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            {open ? "Skjul detaljer" : "Vis detaljer for fagfolk"}
            <ChevronDown
              className={cn("size-3.5 transition-transform", open && "rotate-180")}
              aria-hidden
            />
          </button>
          {open ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
              {summary.fallbackPct != null && summary.fallbackPct > 0 ? (
                <li>{CONTROL_EFFECT_UI.fallbackWithoutOptimization(summary.fallbackPct)}</li>
              ) : null}
              {diagnosis.explanations.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
