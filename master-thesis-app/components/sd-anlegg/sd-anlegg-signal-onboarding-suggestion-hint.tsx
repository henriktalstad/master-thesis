"use client";

import type { SignalMetadataSuggestions } from "@/lib/sd-anlegg/signal-onboarding-suggestions";
import { Button } from "@/components/ui/button";

export function SignalOnboardingSuggestionHint({
  suggestion,
  onApplyAction,
}: {
  suggestion: SignalMetadataSuggestions[keyof SignalMetadataSuggestions];
  onApplyAction: () => void;
}) {
  if (!suggestion) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>
        Forslag:{" "}
        <span className="font-medium text-foreground">{suggestion.value}</span>
      </span>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="h-auto px-0 text-xs"
        onClick={onApplyAction}
      >
        Bruk forslag
      </Button>
    </div>
  );
}
