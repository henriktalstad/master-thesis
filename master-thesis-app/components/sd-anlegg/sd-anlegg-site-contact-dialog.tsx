"use client";

import { useEffect, useReducer, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listSdAnleggContactCandidatesAction,
  upsertSdAnleggSiteProfileAction,
} from "@/actions/infraspawn-read";
import {
  contactDraftReducer,
  emptyContactDraft,
  hasContactDraftDetails,
  trimContactField,
} from "@/lib/sd-anlegg/site-contact-draft-state";
import type { ResolvedSdAnleggSiteProfile } from "@/lib/sd-anlegg/site-profile-schema";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sdAnleggQueryKeys } from "@/queries/infraspawn";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { SdAnleggContactInline } from "./sd-anlegg-site-contact-inline";
import { SdAnleggSiteContactCandidatePicker } from "./sd-anlegg-site-contact-candidate-picker";
import { SdAnleggSiteContactFormFields } from "./sd-anlegg-site-contact-form-fields";
import { cn } from "@/lib/utils";

type Props = {
  buildingSlug: string;
  profile: ResolvedSdAnleggSiteProfile;
  open: boolean;
  onOpenChangeAction: (open: boolean) => void;
  hasSavedContact: boolean;
};

export function SdAnleggSiteContactDialog({
  buildingSlug,
  profile,
  open,
  onOpenChangeAction,
  hasSavedContact,
}: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [draft, dispatch] = useReducer(contactDraftReducer, emptyContactDraft());

  const contactUserId = profile.contactUserId;
  const contactName = profile.contactName;
  const contactPhone = profile.contactPhone;
  const contactEmail = profile.contactEmail;

  useEffect(() => {
    if (!open) return;
    dispatch({
      type: "reset_from_profile",
      profile: {
        contactUserId,
        contactName,
        contactPhone,
        contactEmail,
      },
    });
  }, [open, contactUserId, contactName, contactPhone, contactEmail]);

  const {
    data: candidatesResult,
    isPending: candidatesPending,
    isError: candidatesError,
    refetch: refetchCandidates,
  } = useQuery({
    queryKey: sdAnleggQueryKeys.contactCandidates("thesis"),
    queryFn: listSdAnleggContactCandidatesAction,
    enabled: open,
    staleTime: 60_000,
  });

  const candidates = candidatesResult?.success ? candidatesResult.candidates : [];
  const displayImageUrl = profile.contactImageUrl;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const trimmedName = trimContactField(draft.contactName);
      const trimmedPhone = trimContactField(draft.contactPhone);
      const trimmedEmail = trimContactField(draft.contactEmail);
      const res = await upsertSdAnleggSiteProfileAction({
        buildingSlug,
        profile: {
          contactUserId: draft.selectedUserId || null,
          contactName: trimmedName || null,
          contactPhone: trimmedPhone || null,
          contactEmail: trimmedEmail || null,
        },
      });
      if (!res.success) throw new Error(res.error ?? "Kunne ikke lagre kontakt");
      return res.profile;
    },
    onSuccess: () => {
      toast.success("Kontaktperson lagret");
      onOpenChangeAction(false);
      void queryClient.invalidateQueries({
        queryKey: sdAnleggQueryKeys.profile(buildingSlug),
      });
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () => {
      const res = await upsertSdAnleggSiteProfileAction({
        buildingSlug,
        profile: {
          contactUserId: null,
          contactName: null,
          contactPhone: null,
          contactEmail: null,
        },
      });
      if (!res.success) throw new Error(res.error ?? "Kunne ikke fjerne kontakt");
      return res.profile;
    },
    onSuccess: () => {
      toast.success("Kontaktperson fjernet");
      onOpenChangeAction(false);
      void queryClient.invalidateQueries({
        queryKey: sdAnleggQueryKeys.profile(buildingSlug),
      });
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const isMutating = saveMutation.isPending || clearMutation.isPending;
  const canSave = hasContactDraftDetails(draft);

  function handleUserSelect(userId: string) {
    const candidate = candidates.find((entry) => entry.userId === userId);
    if (!candidate) return;
    dispatch({ type: "apply_candidate", candidate });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave || isMutating) return;
    saveMutation.mutate();
  }

  const previewImageUrl = draft.selectedUserId
    ? (candidates.find((entry) => entry.userId === draft.selectedUserId)
        ?.imageUrl ?? displayImageUrl)
    : displayImageUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChangeAction}>
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          nameInputRef.current?.focus();
        }}
      >
        <div className="border-b border-border/70 px-4 py-4 sm:px-6 sm:py-5">
          <DialogHeader className="space-y-1.5 text-left">
            <DialogTitle>Kontaktperson</DialogTitle>
            <DialogDescription>
              Velg bruker fra organisasjonen eller fyll inn kontaktinfo manuelt.
            </DialogDescription>
          </DialogHeader>
        </div>

        <form className="flex max-h-[min(70vh,36rem)] flex-col" onSubmit={handleSubmit}>
          <div className="space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Forhåndsvisning
              </p>
              {hasContactDraftDetails(draft) ? (
                <SdAnleggContactInline
                  name={trimContactField(draft.contactName) || null}
                  phone={trimContactField(draft.contactPhone) || null}
                  email={trimContactField(draft.contactEmail) || null}
                  imageUrl={previewImageUrl}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Fyll inn kontaktinfo for forhåndsvisning
                </p>
              )}
            </div>

            <SdAnleggSiteContactCandidatePicker
              draft={draft}
              candidates={candidates}
              candidatesPending={candidatesPending}
              candidatesError={candidatesError || candidatesResult?.success === false}
              candidatesErrorMessage={
                candidatesResult?.success === false
                  ? candidatesResult.error
                  : undefined
              }
              isMutating={isMutating}
              onUserSelectAction={handleUserSelect}
              onClearUserSelectionAction={() =>
                dispatch({ type: "clear_user_selection" })
              }
              onRetryCandidatesAction={() => void refetchCandidates()}
            />

            <SdAnleggSiteContactFormFields
              draft={draft}
              dispatch={dispatch}
              nameInputRef={nameInputRef}
              isMutating={isMutating}
            />
          </div>

          <DialogFooter className="gap-2 border-t border-border/70 bg-muted/10 px-4 py-3 sm:justify-between sm:px-6">
            {hasSavedContact ? (
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "text-destructive hover:text-destructive",
                  SD_ANLEGG_BTN_PRESS,
                )}
                disabled={isMutating}
                onClick={() => clearMutation.mutate()}
              >
                {clearMutation.isPending ? "Fjerner …" : "Fjern kontakt"}
              </Button>
            ) : (
              <span className="hidden sm:block" />
            )}
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                type="button"
                variant="outline"
                className={SD_ANLEGG_BTN_PRESS}
                onClick={() => onOpenChangeAction(false)}
                disabled={isMutating}
              >
                Avbryt
              </Button>
              <Button
                type="submit"
                className={SD_ANLEGG_BTN_PRESS}
                disabled={isMutating || !canSave}
              >
                {saveMutation.isPending ? "Lagrer …" : "Lagre kontakt"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
