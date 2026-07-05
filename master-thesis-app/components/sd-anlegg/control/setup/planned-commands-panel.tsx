"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  approveWritebackCommandAction,
  loadPlannedSupervisoryCommandsAction,
  rejectWritebackCommandAction,
  type PlannedCommandsView,
} from "@/actions/supervisory-commands";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONTROL_DISPLAY, CONTROL_SETUP_UI } from "@/lib/sd-anlegg/control/control-display-labels";
import type { ReplayStepSignalRow } from "@/lib/sd-anlegg/control/build-replay-step-signal-matrix";
import { SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";

type PendingCommand = {
  id: string;
  stepAt: string;
  policyId: string;
  kind: string;
  uProposed: unknown;
};

type Props = {
  buildingSlug: string;
  embedded?: boolean;
};

const POLICY_HEADERS = [
  { key: "observed" as const, label: CONTROL_DISPLAY.observed.short },
  { key: "emulated" as const, label: CONTROL_DISPLAY.predicted.short },
  { key: "demand" as const, label: CONTROL_DISPLAY.demand.short },
  { key: "mpc" as const, label: CONTROL_DISPLAY.simulatedControl.short },
];

const KIND_LABELS: Record<keyof PlannedCommandsView["signalGroups"], string> = {
  control: "Pådrag og settpunkter",
  measured_state: "Målinger",
  derived_state: "Avledet tilstand",
  disturbance: "Forstyrrelser",
  constraint: "Begrensninger",
};

function formatCell(value: number | null, unit: string): string {
  if (value == null) return "—";
  if (unit === "°C") return value.toFixed(1);
  return value.toFixed(0);
}

function SignalGroupTable({
  title,
  rows,
}: {
  title: string;
  rows: readonly ReplayStepSignalRow[];
}) {
  const visible = rows.filter(
    (row) =>
      row.observed != null ||
      row.emulated != null ||
      row.demand != null ||
      row.mpc != null,
  );
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="overflow-x-auto">
        <table className="w-full min-w-lg text-xs">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Signal</th>
              {POLICY_HEADERS.map((col) => (
                <th key={col.key} className="py-2 pr-2 font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr key={row.canonicalId} className="border-b border-border/40 last:border-0">
                <td className="py-1.5 pr-3">
                  {row.label}
                  {row.unit ? ` (${row.unit})` : ""}
                </td>
                {POLICY_HEADERS.map((col) => (
                  <td key={col.key} className="py-1.5 pr-2 tabular-nums">
                    {formatCell(row[col.key], row.unit)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SdAnleggControlPlannedCommandsPanel({
  buildingSlug,
  embedded = false,
}: Props) {
  const armed = process.env.NEXT_PUBLIC_MPC_WRITEBACK_ARMED === "1";
  const [view, setView] = useState<PlannedCommandsView | null>(null);
  const [pendingMqtt, setPendingMqtt] = useState<PendingCommand[]>([]);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(() => {
    startTransition(async () => {
      const result = await loadPlannedSupervisoryCommandsAction(buildingSlug);
      if (result.ok) {
        setView(result.view);
        setPendingMqtt(result.pendingMqtt);
      }
    });
  }, [buildingSlug]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const body = (
    <div className="space-y-4 text-xs">
      <p className="text-muted-foreground">{CONTROL_SETUP_UI.plannedCommandsIntro}</p>

      {!view ? (
        <p className="text-muted-foreground">{CONTROL_SETUP_UI.plannedCommandsEmpty}</p>
      ) : (
        <>
          <dl className="grid gap-1 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">{CONTROL_SETUP_UI.plannedCommandsEvalPeriod}</dt>
              <dd>
                {view.evalStart
                  ? `${view.evalStart.slice(0, 10)} → ${view.evalEnd.slice(0, 10)} · `
                  : ""}
                {view.stepCount.toLocaleString("nb-NO")} intervaller
              </dd>
            </div>
          </dl>

            <ul className="flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground">
              {POLICY_HEADERS.map(({ label }) => {
                const id =
                  label === CONTROL_DISPLAY.observed.short
                    ? "observed"
                    : label === CONTROL_DISPLAY.predicted.short
                      ? "emulated"
                      : label === CONTROL_DISPLAY.demand.short
                        ? "demand-scoped"
                        : "mpc-v1";
                return (
                  <li key={id}>
                    {label}:{" "}
                    <span className="tabular-nums text-foreground">
                      {view.policyCounts[id] ?? 0}
                    </span>
                  </li>
                );
              })}
              <li>
                {CONTROL_SETUP_UI.plannedCommandsForwardPlan}:{" "}
                <span className="tabular-nums text-foreground">
                  {view.forwardPlanStepCount}
                </span>
              </li>
            </ul>

            {view.sampleStepAt ? (
              <p className="text-muted-foreground">
                Eksempel (siste intervall):{" "}
                {new Date(view.sampleStepAt).toLocaleString("nb-NO", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </p>
            ) : null}

            {(Object.keys(KIND_LABELS) as (keyof typeof KIND_LABELS)[]).map((kind) => (
              <SignalGroupTable
                key={kind}
                title={KIND_LABELS[kind]}
                rows={view.signalGroups[kind]}
              />
            ))}
          </>
        )}

        {pendingMqtt.length > 0 ? (
          <div className="space-y-2 border-t border-border/60 pt-3">
            <p className="font-medium">Valgfri godkjenning (live)</p>
            <p className="text-muted-foreground">
              Kun for demo mot MQTT. Status: {armed ? "Aktivert" : "Av"}.
            </p>
            <ul className="space-y-2">
              {pendingMqtt.map((cmd) => (
                <li
                  key={cmd.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-2 py-1.5"
                >
                  <span className="tabular-nums">
                    {new Date(cmd.stepAt).toLocaleString("nb-NO")} · {cmd.policyId}
                  </span>
                  <span className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await approveWritebackCommandAction({
                            buildingSlug,
                            commandId: cmd.id,
                          });
                          refresh();
                        })
                      }
                    >
                      Godkjenn
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() =>
                        startTransition(async () => {
                          await rejectWritebackCommandAction({
                            buildingSlug,
                            commandId: cmd.id,
                          });
                          refresh();
                        })
                      }
                    >
                      Avvis
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
    </div>
  );

  if (embedded) return body;

  return (
    <Card className={SD_ANLEGG_CARD}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          {CONTROL_SETUP_UI.plannedCommandsTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">{body}</CardContent>
    </Card>
  );
}
