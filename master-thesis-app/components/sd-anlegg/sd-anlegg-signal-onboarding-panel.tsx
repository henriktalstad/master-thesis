"use client";

import { useMemo, useState } from "react";
import { buildAhuPresentationModel } from "@/lib/sd-anlegg/ahu-equipment-identification";
import {
  findPointMetadataOverride,
  pointMetadataOverrideKey,
} from "@/lib/sd-anlegg/point-metadata-overrides";
import {
  buildSignalOnboardingReviewQueue,
  suggestPointMetadataOverride,
} from "@/lib/sd-anlegg/signal-onboarding-suggestions";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useSdAnleggEffectiveIdentification } from "./use-sd-anlegg-effective-identification";
import { sdAnleggPointKey } from "./sd-anlegg-point-key";
import { SdAnleggSignalOnboardingPointEditor } from "./sd-anlegg-signal-onboarding-point-editor";

type DomainUnitOption = {
  scopeId: string;
  displayName: string;
};

type PanelProps = {
  buildingSlug: string;
  points: readonly InfraspawnPointListItem[];
  elementKey?: string | null;
  domainUnits: readonly DomainUnitOption[];
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  initialPoint?: InfraspawnPointListItem | null;
};

export function SdAnleggSignalOnboardingPanel({
  buildingSlug,
  points,
  elementKey,
  domainUnits,
  open,
  onOpenChangeAction,
  initialPoint = null,
}: PanelProps) {
  const { overrides, schemaSlotOverrides } = useSdAnleggEffectiveIdentification();

  const model = useMemo(
    () =>
      buildAhuPresentationModel(points, {
        elementKey: elementKey ?? null,
        schemaSlotOverrides,
      }),
    [points, elementKey, schemaSlotOverrides],
  );

  const missingSlots = useMemo(
    () =>
      [...model.processSlots, ...model.statusSlots].filter(
        (slot) => slot.confidence === "missing",
      ),
    [model],
  );

  const overriddenKeys = useMemo(
    () =>
      new Set(
        overrides.map((entry) =>
          pointMetadataOverrideKey(entry.sourceId, entry.objectId),
        ),
      ),
    [overrides],
  );

  const reviewQueue = useMemo(
    () =>
      buildSignalOnboardingReviewQueue({
        points,
        elementKey,
        schemaSlotOverrides,
        overriddenKeys,
      }),
    [points, elementKey, schemaSlotOverrides, overriddenKeys],
  );

  const [selectedPointKey, setSelectedPointKey] = useState("");

  const defaultPointKey = useMemo(() => {
    if (!open) return "";
    const first = reviewQueue[0]?.point ?? initialPoint ?? points[0] ?? null;
    return first ? sdAnleggPointKey(first) : "";
  }, [open, reviewQueue, initialPoint, points]);

  const activePointKey = selectedPointKey || defaultPointKey;

  const selectedPoint = useMemo(() => {
    if (!activePointKey) return null;
    return (
      points.find((point) => sdAnleggPointKey(point) === activePointKey) ?? null
    );
  }, [activePointKey, points]);

  const existingOverride = selectedPoint
    ? findPointMetadataOverride(overrides, selectedPoint)
    : null;

  const currentSuggestions = useMemo(() => {
    if (!selectedPoint) return {};
    return suggestPointMetadataOverride({
      point: selectedPoint,
      elementKey,
      model,
    });
  }, [selectedPoint, elementKey, model]);

  const editorInstanceKey = selectedPoint
    ? `${sdAnleggPointKey(selectedPoint)}:${
        existingOverride
          ? pointMetadataOverrideKey(
              existingOverride.sourceId,
              existingOverride.objectId,
            )
          : "none"
      }`
    : "none";

  const handlePointChange = (key: string) => {
    setSelectedPointKey(key);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChangeAction(next);
        if (!next) {
          setSelectedPointKey("");
        }
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Kartlegg signaler</DialogTitle>
          <DialogDescription>
            Rett metadata som påvirker TFM og skjema-binding. Lagrede felt
            beholdes ved sync (sticky per felt).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant="outline">Direkte {model.summary.exact}</Badge>
            <Badge variant="outline">Alias {model.summary.alias}</Badge>
            <Badge variant="outline">Utledet {model.summary.inferred}</Badge>
            <Badge variant="secondary">Mangler {model.summary.missing}</Badge>
            <span className="text-muted-foreground">
              {model.summary.coveragePct} % koblet
            </span>
          </div>

          {missingSlots.length > 0 ? (
            <div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
              <p className="font-medium">Manglende slotter</p>
              <p className="mt-1 text-muted-foreground">
                {missingSlots
                  .slice(0, 8)
                  .map((slot) =>
                    "equipmentCode" in slot ? slot.equipmentCode : slot.label,
                  )
                  .join(", ")}
                {missingSlots.length > 8 ? " …" : ""}
              </p>
            </div>
          ) : null}

          {reviewQueue.length > 0 ? (
            <div className="space-y-2">
              <Label>Forslått kø ({reviewQueue.length})</Label>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/60 p-1">
                {reviewQueue.slice(0, 12).map((item) => {
                  const key = sdAnleggPointKey(item.point);
                  const isActive = selectedPoint
                    ? sdAnleggPointKey(selectedPoint) === key
                    : false;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        className={cn(
                          "flex w-full flex-col rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-foreground"
                            : "hover:bg-muted/60",
                        )}
                        onClick={() => handlePointChange(key)}
                      >
                        <span className="font-medium">
                          {item.point.objectName ?? item.point.objectId}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {item.reason}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="signal-onboarding-point">Signal</Label>
            <Select
              value={selectedPoint ? sdAnleggPointKey(selectedPoint) : ""}
              onValueChange={handlePointChange}
            >
              <SelectTrigger id="signal-onboarding-point">
                <SelectValue placeholder="Velg signal å rette" />
              </SelectTrigger>
              <SelectContent>
                {points.map((point) => (
                  <SelectItem
                    key={sdAnleggPointKey(point)}
                    value={sdAnleggPointKey(point)}
                  >
                    {point.objectName ?? point.objectId}
                    {point.description ? ` — ${point.description}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPoint ? (
            <SdAnleggSignalOnboardingPointEditor
              key={editorInstanceKey}
              buildingSlug={buildingSlug}
              point={selectedPoint}
              overrides={overrides}
              elementKey={elementKey}
              model={model}
              domainUnits={domainUnits}
              currentSuggestions={currentSuggestions}
              preferSuggestions={!selectedPointKey}
              onCloseAction={() => onOpenChangeAction(false)}
            />
          ) : null}
        </div>

        {!selectedPoint ? (
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChangeAction(false)}
            >
              Lukk
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
