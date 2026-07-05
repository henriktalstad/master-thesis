"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { upsertSdAnleggAnleggsenhetDisplayNameAction } from "@/actions/infraspawn-read";
import {
  formatAnleggsenhetUnitKeyForDisplay,
  type SdAnleggsenhet,
} from "@/lib/sd-anlegg/infer-anleggsenheter";
import { resolveAnleggsenhetDisplayName } from "@/lib/sd-anlegg/anleggsenhet-display-overrides";
import {
  extractDescriptiveNameFromSourceLabel,
  formatAnleggsenhetDisplay,
} from "@/lib/sd-anlegg/anleggsenhet-display";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";
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
  unit: Pick<SdAnleggsenhet, "id" | "unitKey" | "displayName">;
  profile: ResolvedSdAnleggSiteProfile;
  canEdit: boolean;
  variant?: "icon" | "button";
  className?: string;
};

function normalizeDraftDisplayName(unitKey: string, draft: string): string {
  const trimmed = draft.trim();
  if (!trimmed) return "";
  const extracted = extractDescriptiveNameFromSourceLabel(trimmed, unitKey);
  if (extracted) return formatAnleggsenhetDisplay(unitKey, extracted);
  const code = formatAnleggsenhetUnitKeyForDisplay(unitKey);
  if (trimmed.includes(code)) return trimmed;
  return formatAnleggsenhetDisplay(unitKey, trimmed);
}

export function SdAnleggAnleggsenhetNameEditor(props: Props) {
  if (!props.canEdit) return null;
  return <SdAnleggAnleggsenhetNameEditorInner {...props} />;
}

function SdAnleggAnleggsenhetNameEditorInner({
  buildingSlug,
  unit,
  profile,
  variant = "icon",
  className,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draftName, setDraftName] = useState("");

  const effectiveName = resolveAnleggsenhetDisplayName(
    unit.id,
    unit.displayName,
    profile.anleggsenhetDisplayOverrides,
  );
  const codeLabel = formatAnleggsenhetUnitKeyForDisplay(unit.unitKey);
  const hasCustomName = profile.anleggsenhetDisplayOverrides.some(
    (entry) => entry.scopeId === unit.id,
  );

  const saveMutation = useMutation({
    mutationFn: async (displayName: string) => {
      const res = await upsertSdAnleggAnleggsenhetDisplayNameAction({
        buildingSlug,
        scopeId: unit.id,
        displayName,
      });
      if (!res.success) throw new Error(res.error);
      return res.profile;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: sdAnleggQueryKeys.profile(buildingSlug),
      });
      router.refresh();
      toast.success("Anleggsnavn lagret");
      setOpen(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Kunne ikke lagre anleggsnavn");
    },
  });

  const openEditor = () => {
    setDraftName(effectiveName);
    setOpen(true);
  };

  const saveDisplayName = normalizeDraftDisplayName(unit.unitKey, draftName);

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
            className,
          )}
          aria-label={`Rediger navn for ${effectiveName}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openEditor();
          }}
        >
          <Pencil className="size-3.5" aria-hidden />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(SD_ANLEGG_BTN_PRESS, className)}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openEditor();
          }}
        >
          <Pencil className="size-3.5" aria-hidden />
          Rediger navn
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Anleggsnavn</DialogTitle>
            <DialogDescription>
              Sett visningsnavn for ventilasjons- eller varmeanlegg. Koden{" "}
              <span className="font-medium text-foreground">{codeLabel}</span>{" "}
              følger signalene og endres ikke her.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-2">
              <Label htmlFor="anleggsenhet-display-name">Visningsnavn</Label>
              <Input
                id="anleggsenhet-display-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                placeholder="F.eks. Boligdel blokk A"
                autoComplete="off"
              />
              {!hasCustomName ? (
                <p className="text-xs text-muted-foreground">
                  Forhåndsvisning:{" "}
                  {normalizeDraftDisplayName(unit.unitKey, draftName) ||
                    codeLabel}
                </p>
              ) : null}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
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
              onClick={() => saveMutation.mutate(saveDisplayName)}
              disabled={saveMutation.isPending || !saveDisplayName}
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
