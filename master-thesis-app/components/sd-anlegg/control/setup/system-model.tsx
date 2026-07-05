import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  ControlPlantModel,
  ResolvedControlSignal,
} from "@/lib/sd-anlegg/control/control-types";
import { CONTROL_SIGNAL_SPECS_360102 } from "@/lib/sd-anlegg/control/control-signal-registry-360102";
import { formatInfraspawnPointValue } from "@/lib/infraspawn/display-format";
import { SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";

type Props = {
  plantModel: ControlPlantModel;
  /** Uten ytre kort når panel ligger i collapsible. */
  embedded?: boolean;
};

function availabilityBadge(signal: ResolvedControlSignal) {
  if (signal.availability === "available") {
    return (
      <Badge variant="secondary" className="font-normal">
        Live OK
      </Badge>
    );
  }
  if (signal.availability === "expected_missing") {
    return (
      <Badge
        variant="outline"
        className="border-warning/40 bg-warning/10 font-normal text-warning-foreground"
      >
        Forventet hull
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="font-normal text-muted-foreground">
      Mangler
    </Badge>
  );
}

function SignalRow({ signal }: { signal: ResolvedControlSignal }) {
  const spec = CONTROL_SIGNAL_SPECS_360102.find(
    (s) => s.canonicalId === signal.catalog.canonicalId,
  );
  const point = signal.point;
  return (
    <li className="flex flex-col gap-2 rounded-lg border border-border/80 bg-muted/15 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {signal.catalog.label}
        </p>
        {spec ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {spec.controlRole === "mpc_actuator" ? (
              <Badge variant="secondary" className="h-5 text-[10px] font-normal">
                Styring
              </Badge>
            ) : null}
            {spec.inUMeasRequired ? (
              <Badge variant="secondary" className="h-5 text-[10px] font-normal">
                Måling
              </Badge>
            ) : null}
            {spec.inEvalDataset ? (
              <Badge variant="outline" className="h-5 text-[10px] font-normal">
                Replay
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {signal.lastValue != null ? (
          <span className="text-sm font-semibold tabular-nums text-primary">
            {formatInfraspawnPointValue(signal.lastValue, point?.unit ?? null)}
          </span>
        ) : null}
        {availabilityBadge(signal)}
      </div>
    </li>
  );
}

function SignalGroup({
  title,
  signals,
}: {
  title: string;
  signals: ResolvedControlSignal[];
}) {
  if (signals.length === 0) return null;
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <ul className="space-y-2">
        {signals.map((signal) => (
          <SignalRow key={signal.catalog.canonicalId} signal={signal} />
        ))}
      </ul>
    </div>
  );
}

function SystemModelBody({ plantModel }: { plantModel: ControlPlantModel }) {
  return (
    <div className="space-y-5">
      {plantModel.subsystems.map((subsystem) => (
        <section
          key={subsystem.id}
          className="rounded-xl border border-border/80 bg-background/60 p-4"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">
              {subsystem.label}
            </h3>
            <Badge variant="outline" className="font-normal">
              {subsystem.controls.length + subsystem.states.length} signaler
            </Badge>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <SignalGroup title="Styring" signals={subsystem.controls} />
            <SignalGroup title="Tilstand" signals={subsystem.states} />
            <SignalGroup title="Begrensninger" signals={subsystem.constraints} />
          </div>
        </section>
      ))}
    </div>
  );
}

export function SdAnleggControlSystemModel({ plantModel, embedded = false }: Props) {
  if (embedded) {
    return <SystemModelBody plantModel={plantModel} />;
  }

  return (
    <Card className={SD_ANLEGG_CARD}>
      <CardHeader>
        <CardTitle className="text-base">Signaler per delsystem</CardTitle>
        <CardDescription>
          AHU {plantModel.unitKey} — hva modellen kan lese og styre.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SystemModelBody plantModel={plantModel} />
      </CardContent>
    </Card>
  );
}
