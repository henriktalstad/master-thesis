"use client";

import Link from "next/link";
import { controlStyringHref } from "@/lib/sd-anlegg/control/resolve-control-lookback";
import { formatControlStepLabel } from "@/lib/sd-anlegg/control/chart-utils";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  liveSampledAt?: string | null;
  examinerMode?: boolean;
  replayStepCount?: number;
};

export function SdAnleggControlLiveEmpty({
  buildingSlug,
  liveSampledAt = null,
  examinerMode = false,
  replayStepCount,
}: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-2 px-4 py-8 text-center"
      aria-label="Venter på styringssammenligning"
    >
      <span
        className="size-2 rounded-full bg-muted-foreground/30 motion-safe:animate-pulse"
        aria-hidden
      />
      <p className="text-sm font-medium text-foreground">Henter styringssammenligning</p>
      <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
        {liveSampledAt
          ? `SD målt ${formatControlStepLabel(liveSampledAt)} — venter på mpc-v1 replay og plan fra live data.`
          : examinerMode
            ? "Live SD er tilkoblet. Historisk eval og live tick fylles når replay er klar."
            : "Målt drift, simulert forslag og plan vises når SD og replay er klare."}
      </p>
      {examinerMode && replayStepCount != null && replayStepCount > 0 ? (
        <p className="max-w-sm text-[11px] text-muted-foreground">
          Thesis-eval: {replayStepCount.toLocaleString("nb-NO")} perioder à 15 min i Effekt-fanen.
          Live tick her er supplement på samme målte SD-grunnlag.
        </p>
      ) : null}
      <Link
        href={controlStyringHref(buildingSlug, { tab: "oppsett" })}
        prefetch
        className={cn(
          "mt-1 text-xs font-medium text-primary underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:underline",
          SD_ANLEGG_BTN_PRESS,
        )}
      >
        Sjekk signaldekning i Oppsett
      </Link>
    </div>
  );
}
