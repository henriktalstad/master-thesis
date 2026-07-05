"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  removeSdAnleggPointMetadataOverrideAction,
  upsertSdAnleggPointMetadataOverrideAction,
} from "@/actions/infraspawn-read";
import {
  AHU_BLUEPRINT_PROCESS_SLOTS,
  AHU_BLUEPRINT_STATUS_SLOTS,
} from "@/lib/sd-anlegg/ahu-blueprint";
import type { buildAhuPresentationModel } from "@/lib/sd-anlegg/ahu-equipment-identification";
import { findPointMetadataOverride } from "@/lib/sd-anlegg/point-metadata-overrides";
import type { SignalMetadataSuggestions } from "@/lib/sd-anlegg/signal-onboarding-suggestions";
import {
  buildInitialSignalFormState,
  signalOnboardingFormReducer,
} from "@/lib/sd-anlegg/signal-onboarding-form-state";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SdAnleggPointMetadataOverride } from "@/lib/sd-anlegg/point-metadata-overrides";
import { sdAnleggQueryKeys } from "@/queries/infraspawn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { SignalOnboardingSuggestionHint } from "./sd-anlegg-signal-onboarding-suggestion-hint";

const SLOT_OPTIONS = [
  ...AHU_BLUEPRINT_PROCESS_SLOTS.map((slot) => ({
    id: slot.slotId,
    label: `${slot.equipmentCode} · ${slot.label ?? slot.role}`,
  })),
  ...AHU_BLUEPRINT_STATUS_SLOTS.map((slot) => ({
    id: slot.slotId,
    label: slot.label,
  })),
];

type DomainUnitOption = {
  scopeId: string;
  displayName: string;
};

type Props = {
  buildingSlug: string;
  point: InfraspawnPointListItem;
  overrides: readonly SdAnleggPointMetadataOverride[];
  elementKey?: string | null;
  model: ReturnType<typeof buildAhuPresentationModel>;
  domainUnits: readonly DomainUnitOption[];
  currentSuggestions: SignalMetadataSuggestions;
  preferSuggestions?: boolean;
  onCloseAction: () => void;
};

export function SdAnleggSignalOnboardingPointEditor({
  buildingSlug,
  point,
  overrides,
  elementKey,
  model,
  domainUnits,
  currentSuggestions,
  preferSuggestions,
  onCloseAction,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const existingOverride = findPointMetadataOverride(overrides, point);

  const [form, dispatch] = useReducer(
    signalOnboardingFormReducer,
    { point, overrides, elementKey, model, preferSuggestions },
    buildInitialSignalFormState,
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await upsertSdAnleggPointMetadataOverrideAction({
        buildingSlug,
        override: {
          sourceId: point.sourceId,
          objectId: point.objectId,
          objectName: form.objectName,
          description: form.description,
          subCentral: form.subCentral,
          scopeId: form.scopeId || undefined,
          schemaSlotId: form.schemaSlotId || undefined,
        },
      });
      if (!res.success) throw new Error(res.error);
      return res.profile;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sdAnleggQueryKeys.profile(buildingSlug),
      });
      void queryClient.invalidateQueries({
        queryKey: sdAnleggQueryKeys.points(buildingSlug),
      });
      router.refresh();
      toast.success("Signal-metadata lagret");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke lagre");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await removeSdAnleggPointMetadataOverrideAction({
        buildingSlug,
        sourceId: point.sourceId,
        objectId: point.objectId,
      });
      if (!res.success) throw new Error(res.error);
      return res.profile;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sdAnleggQueryKeys.profile(buildingSlug),
      });
      void queryClient.invalidateQueries({
        queryKey: sdAnleggQueryKeys.points(buildingSlug),
      });
      router.refresh();
      toast.success("Override fjernet");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke fjerne");
    },
  });

  const isMutating = saveMutation.isPending || removeMutation.isPending;

  return (
    <>
      {Object.keys(currentSuggestions).length > 0 ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={SD_ANLEGG_BTN_PRESS}
            onClick={() =>
              dispatch({
                type: "apply_suggestions",
                suggestions: currentSuggestions,
              })
            }
          >
            Bruk alle forslag
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="signal-object-name">Navn (objectName)</Label>
          <Input
            id="signal-object-name"
            value={form.objectName}
            onChange={(event) =>
              dispatch({
                type: "set_field",
                field: "objectName",
                value: event.target.value,
              })
            }
            placeholder="F.eks. 360102_RT401_PV"
          />
          {point.objectName && point.objectName !== form.objectName ? (
            <p className="text-xs text-muted-foreground">
              Speil: {point.objectName}
            </p>
          ) : null}
          {currentSuggestions.objectName &&
          currentSuggestions.objectName.value !== form.objectName ? (
            <SignalOnboardingSuggestionHint
              suggestion={currentSuggestions.objectName}
              onApplyAction={() =>
                dispatch({
                  type: "set_field",
                  field: "objectName",
                  value: currentSuggestions.objectName!.value,
                })
              }
            />
          ) : null}
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="signal-description">Beskrivelse</Label>
          <Input
            id="signal-description"
            value={form.description}
            onChange={(event) =>
              dispatch({
                type: "set_field",
                field: "description",
                value: event.target.value,
              })
            }
            placeholder="F.eks. Temp. tilluft"
          />
          {currentSuggestions.description &&
          currentSuggestions.description.value !== form.description ? (
            <SignalOnboardingSuggestionHint
              suggestion={currentSuggestions.description}
              onApplyAction={() =>
                dispatch({
                  type: "set_field",
                  field: "description",
                  value: currentSuggestions.description!.value,
                })
              }
            />
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="signal-sub-central">Undersentral</Label>
          <Input
            id="signal-sub-central"
            value={form.subCentral}
            onChange={(event) =>
              dispatch({
                type: "set_field",
                field: "subCentral",
                value: event.target.value,
              })
            }
            placeholder="F.eks. CPU1003"
          />
        </div>
        {domainUnits.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="signal-scope">Anleggsenhet</Label>
            <Select
              value={form.scopeId || "__none__"}
              onValueChange={(value) =>
                dispatch({
                  type: "set_field",
                  field: "scopeId",
                  value: value === "__none__" ? "" : value,
                })
              }
            >
              <SelectTrigger id="signal-scope">
                <SelectValue placeholder="Velg enhet" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Auto-detektert</SelectItem>
                {domainUnits.map((unit) => (
                  <SelectItem key={unit.scopeId} value={unit.scopeId}>
                    {unit.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {currentSuggestions.scopeId &&
            currentSuggestions.scopeId.value !== form.scopeId ? (
              <SignalOnboardingSuggestionHint
                suggestion={currentSuggestions.scopeId}
                onApplyAction={() =>
                  dispatch({
                    type: "set_field",
                    field: "scopeId",
                    value: currentSuggestions.scopeId!.value,
                  })
                }
              />
            ) : null}
          </div>
        ) : null}
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="signal-slot">Utstyrsslot (valgfritt)</Label>
          <Select
            value={form.schemaSlotId || "__none__"}
            onValueChange={(value) =>
              dispatch({
                type: "set_field",
                field: "schemaSlotId",
                value: value === "__none__" ? "" : value,
              })
            }
          >
            <SelectTrigger id="signal-slot">
              <SelectValue placeholder="Auto-binding" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Auto-binding</SelectItem>
              {SLOT_OPTIONS.map((slot) => (
                <SelectItem key={slot.id} value={slot.id}>
                  {slot.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {currentSuggestions.schemaSlotId &&
          currentSuggestions.schemaSlotId.value !== form.schemaSlotId ? (
            <SignalOnboardingSuggestionHint
              suggestion={currentSuggestions.schemaSlotId}
              onApplyAction={() =>
                dispatch({
                  type: "set_field",
                  field: "schemaSlotId",
                  value: currentSuggestions.schemaSlotId!.value,
                })
              }
            />
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 sm:justify-end">
        {existingOverride ? (
          <Button
            type="button"
            variant="ghost"
            className="mr-auto text-muted-foreground"
            disabled={isMutating}
            onClick={() => removeMutation.mutate()}
          >
            Fjern override
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          onClick={onCloseAction}
          disabled={isMutating}
        >
          Lukk
        </Button>
        <Button
          type="button"
          disabled={isMutating}
          onClick={() => saveMutation.mutate()}
        >
          {saveMutation.isPending ? (
            <>
              <Spinner variant="dots" className="mr-2" />
              Lagrer …
            </>
          ) : (
            "Lagre"
          )}
        </Button>
      </div>
    </>
  );
}
