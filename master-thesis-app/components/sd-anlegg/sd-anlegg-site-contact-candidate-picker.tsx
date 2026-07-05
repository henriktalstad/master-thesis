"use client";

import type { SdAnleggContactCandidate } from "@/actions/infraspawn-read";
import type { ContactDraftState } from "@/lib/sd-anlegg/site-contact-draft-state";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

export function formatCandidateComboboxLabel(
  candidate: SdAnleggContactCandidate,
): string {
  const details = [candidate.phone, candidate.email].filter(Boolean);
  return details.length > 0
    ? `${candidate.name} · ${details.join(" · ")}`
    : candidate.name;
}

type Props = {
  draft: ContactDraftState;
  candidates: readonly SdAnleggContactCandidate[];
  candidatesPending: boolean;
  candidatesError: boolean;
  candidatesErrorMessage?: string;
  isMutating: boolean;
  onUserSelectAction: (userId: string) => void;
  onClearUserSelectionAction: () => void;
  onRetryCandidatesAction: () => void;
};

export function SdAnleggSiteContactCandidatePicker({
  draft,
  candidates,
  candidatesPending,
  candidatesError,
  candidatesErrorMessage,
  isMutating,
  onUserSelectAction,
  onClearUserSelectionAction,
  onRetryCandidatesAction,
}: Props) {
  return (
    <div className="space-y-0 rounded-xl border border-border/80 bg-muted/15 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Velg fra org
      </p>
      <div className="mt-3 space-y-2">
        <Label htmlFor="sd-anlegg-contact-user">Bruker</Label>
        {candidatesPending ? (
          <div
            className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-muted/20 px-3 text-sm text-muted-foreground"
            aria-live="polite"
          >
            <Spinner variant="dots" decorative className="size-4" />
            Laster brukere …
          </div>
        ) : candidatesError ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
            <p className="text-destructive">
              {candidatesErrorMessage ?? "Kunne ikke laste brukere."}
            </p>
            <Button
              type="button"
              variant="link"
              className="mt-1 h-auto px-0 text-destructive"
              onClick={onRetryCandidatesAction}
            >
              Prøv igjen
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <Combobox
              id="sd-anlegg-contact-user"
              value={draft.selectedUserId || undefined}
              onChangeAction={onUserSelectAction}
              options={candidates.map((candidate) => ({
                value: candidate.userId,
                label: formatCandidateComboboxLabel(candidate),
              }))}
              placeholder="Velg bruker …"
              buttonClassName="h-9 w-full font-normal"
              className="w-(--radix-popover-trigger-width) p-0"
              disabled={isMutating}
              modal={false}
            />
            {draft.selectedUserId ? (
              <Button
                type="button"
                variant="link"
                className="h-auto px-0 text-xs"
                disabled={isMutating}
                onClick={onClearUserSelectionAction}
              >
                Fjern brukervalg
              </Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
