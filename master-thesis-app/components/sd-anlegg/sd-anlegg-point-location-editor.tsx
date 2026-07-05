"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MapPin, Pencil } from "lucide-react";
import { toast } from "sonner";
import { upsertSdAnleggPointLocationLabelAction } from "@/actions/infraspawn-read";
import { resolveSdAnleggPointLocationLabel } from "@/lib/sd-anlegg/resolve-point-location-label";
import { findPointDisplayOverride } from "@/lib/sd-anlegg/point-display-overrides";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { sdAnleggQueryKeys } from "@/queries/infraspawn";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  sourceId: string;
  objectId: string;
  profile: ResolvedSdAnleggSiteProfile;
  canEdit: boolean;
  point?: Pick<
    InfraspawnPointListItem,
    "objectName" | "description" | "sourceLabel"
  > | null;
  relatedPoints?: readonly InfraspawnPointListItem[];
  signalHint?: string | null;
  equipmentRef?: string | null;
  variant?: "icon" | "button";
  className?: string;
};

export function SdAnleggPointLocationEditor(props: Props) {
  if (!props.canEdit) return null;
  return <SdAnleggPointLocationEditorInner {...props} />;
}

function SdAnleggPointLocationEditorInner({
  buildingSlug,
  sourceId,
  objectId,
  profile,
  point = null,
  relatedPoints,
  signalHint,
  equipmentRef,
  variant = "icon",
  className,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");

  const manualOverride = findPointDisplayOverride(
    profile.pointDisplayOverrides,
    sourceId,
    objectId,
  );
  const inferredLabel = resolveSdAnleggPointLocationLabel({
    sourceId,
    objectId,
    profile,
    point: point ? { ...point, objectId } : null,
    relatedPoints,
  });
  const effectiveLabel = manualOverride?.label ?? inferredLabel;
  const hasManualLabel = manualOverride != null;

  const saveMutation = useMutation({
    mutationFn: async (label: string) => {
      const res = await upsertSdAnleggPointLocationLabelAction({
        buildingSlug,
        sourceId,
        objectId,
        label,
      });
      if (!res.success) throw new Error(res.error);
      return res.profile;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sdAnleggQueryKeys.profile(buildingSlug),
      });
      void queryClient.invalidateQueries({
        queryKey: ["sd-anlegg", "alarms", buildingSlug],
      });
      router.refresh();
      toast.success("Plassering lagret");
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke lagre plassering");
    },
  });

  const openEditor = () => {
    setDraftLabel(manualOverride?.label ?? inferredLabel ?? "");
    setOpen(true);
  };

  const contextLine = [equipmentRef, signalHint].filter(Boolean).join(" · ");

  return (
    <>
      {variant === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "size-7 shrink-0 text-muted-foreground",
            SD_ANLEGG_BTN_PRESS,
            !effectiveLabel && "text-amber-700 dark:text-amber-300",
            className,
          )}
          aria-label={
            effectiveLabel
              ? `Rediger plassering for ${effectiveLabel}`
              : "Sett plassering eller rom"
          }
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openEditor();
          }}
        >
          {effectiveLabel ? (
            <Pencil className="size-3.5" aria-hidden />
          ) : (
            <MapPin className="size-3.5" aria-hidden />
          )}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(SD_ANLEGG_BTN_PRESS, "gap-1.5", className)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openEditor();
          }}
        >
          <MapPin className="size-3.5" aria-hidden />
          {effectiveLabel ? "Rediger plassering" : "Sett plassering"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Plassering / rom</DialogTitle>
            <DialogDescription>
              Sett hvor i bygget signalet sitter. Brukes i alarmer og signallister
              når TFM-koden ikke sier nok.
              {contextLine ? (
                <>
                  {" "}
                  Signal:{" "}
                  <span className="font-medium text-foreground">{contextLine}</span>
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="point-location-label">Plassering</Label>
              <Input
                id="point-location-label"
                value={draftLabel}
                onChange={(event) => setDraftLabel(event.target.value)}
                placeholder="F.eks. Heissjakt bygg B, møterom 3. etg."
                autoComplete="off"
              />
              {!hasManualLabel && inferredLabel ? (
                <p className="text-xs text-muted-foreground">
                  Foreslått fra signal: {inferredLabel}
                </p>
              ) : null}
              {!hasManualLabel && !inferredLabel ? (
                <p className="text-xs text-muted-foreground">
                  Ingen plassering funnet — fyll inn manuelt.
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            {hasManualLabel ? (
              <Button
                type="button"
                variant="ghost"
                className="mr-auto text-muted-foreground"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate("")}
              >
                Fjern manuell
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={saveMutation.isPending}
            >
              Avbryt
            </Button>
            <Button
              type="button"
              onClick={() => saveMutation.mutate(draftLabel.trim())}
              disabled={saveMutation.isPending || !draftLabel.trim()}
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
