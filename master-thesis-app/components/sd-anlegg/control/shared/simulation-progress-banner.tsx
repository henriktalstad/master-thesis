"use client";

import { useTransition } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ensureMpcThesisDataAction,
  recoverMpcSimulationJobAction,
} from "@/actions/mpc-thesis";
import type { MpcSimulationProgress } from "@/lib/sd-anlegg/control/mpc-simulation-progress";
import { Button } from "@/components/ui/button";
import { SD_ANLEGG_BTN_PRESS, SD_ANLEGG_INFO_BANNER } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";
import { invalidateStyringWorkspacePollQueries } from "@/queries/styring";

type Props = {
  buildingSlug: string;
  progress: MpcSimulationProgress | null;
  incompleteSteps?: {
    persisted: number;
    expected: number;
  } | null;
  className?: string;
  examinerMode?: boolean;
};

export function SdAnleggControlSimulationProgressBanner({
  buildingSlug,
  progress,
  incompleteSteps = null,
  className,
  examinerMode = false,
}: Props) {
  const queryClient = useQueryClient();
  const [pending, startTransition] = useTransition();

  if (examinerMode) return null;
  if (!progress || progress.status === "idle") return null;

  function recoverStaleJob() {
    startTransition(async () => {
      await recoverMpcSimulationJobAction(buildingSlug);
      await invalidateStyringWorkspacePollQueries(queryClient, buildingSlug);
    });
  }

  function resumeSimulation() {
    startTransition(async () => {
      await ensureMpcThesisDataAction({
        buildingSlug,
        runSimulation: true,
      });
      await invalidateStyringWorkspacePollQueries(queryClient, buildingSlug);
    });
  }

  if (progress.status === "completed") {
    return (
      <div
        className={cn(
          SD_ANLEGG_INFO_BANNER,
          "border-emerald-500/30 bg-emerald-500/5",
          className,
        )}
        role="status"
      >
        <p className="font-medium text-foreground">Simulering fullført</p>
        {progress.message ? (
          <p className="mt-1 text-muted-foreground">{progress.message}</p>
        ) : null}
      </div>
    );
  }

  if (progress.status === "failed") {
    const canResume =
      incompleteSteps != null &&
      incompleteSteps.persisted > 0 &&
      incompleteSteps.persisted < incompleteSteps.expected;

    return (
      <div
        className={cn(
          SD_ANLEGG_INFO_BANNER,
          "border-amber-500/40 bg-amber-500/10",
          className,
        )}
        role="alert"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-foreground">
              {canResume ? "Simulering satt på pause" : "Simulering feilet"}
            </p>
            {canResume ? (
              <p className="mt-1 text-muted-foreground">
                Trolig tidsavbrudd i bakgrunnsjobben ({progress.stepIndex} av{" "}
                {progress.stepTotal || incompleteSteps.expected} intervaller
                ferdig). Viser {incompleteSteps.persisted} av{" "}
                {incompleteSteps.expected} i Effekt — trykk Fortsett for å gjenoppta
                der den stoppet.
              </p>
            ) : progress.message ? (
              <p className="mt-1 text-muted-foreground">{progress.message}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {canResume ? (
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={resumeSimulation}
                className={SD_ANLEGG_BTN_PRESS}
              >
                {pending ? "Starter …" : "Fortsett simulering"}
              </Button>
            ) : null}
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={recoverStaleJob}
              className={SD_ANLEGG_BTN_PRESS}
            >
              {pending ? "Rydder …" : "Skjul varsel"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const pct = progress.pct ?? 0;
  const label =
    progress.message ??
    (progress.stepTotal > 0
      ? `Simulering ${progress.stepIndex}/${progress.stepTotal}`
      : "Simulering pågår");

  if (progress.stale) {
    return (
      <div
        className={cn(
          SD_ANLEGG_INFO_BANNER,
          "border-amber-500/40 bg-amber-500/10",
          className,
        )}
        role="alert"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-foreground">Simulering henger</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {label} · {pct} %
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending}
            onClick={recoverStaleJob}
            className={cn(SD_ANLEGG_BTN_PRESS, "shrink-0")}
          >
            {pending ? "Rydder …" : "Avbryt"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(SD_ANLEGG_INFO_BANNER, className)}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-foreground">{label}</p>
        {progress.pct != null ? (
          <span className="tabular-nums text-muted-foreground">{pct} %</span>
        ) : null}
      </div>
      {progress.stepTotal > 0 ? (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/15"
          aria-hidden
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}
