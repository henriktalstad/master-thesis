"use client";

import { useCallback, useState } from "react";
import { ChevronDown, Copy, Check, Mail } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  INFRASPAWN_POLL_REQUEST_SIGNALS,
  formatInfraspawnPollRequestMarkdown,
  formatInfraspawnPollMailto,
} from "@/lib/sd-anlegg/control/infraspawn-poll-request";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  buildingName: string;
  unitKey: string;
};

export function SdAnleggControlMissingSignals({
  buildingName,
  unitKey,
}: Props) {
  const [copied, setCopied] = useState(false);
  const markdown = formatInfraspawnPollRequestMarkdown(buildingName, unitKey);
  const mailto = formatInfraspawnPollMailto(buildingName, unitKey);

  const copyRequest = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [markdown]);

  return (
    <Collapsible>
      <CollapsibleTrigger
        className={cn(
          "flex w-full items-center justify-between rounded-xl border border-border/80 bg-muted/15 px-4 py-3 text-sm",
          SD_ANLEGG_BTN_PRESS,
        )}
      >
        <span>
          <span className="font-medium">Be om flere SD-signaler</span>
          <span className="text-muted-foreground">
            {" "}
            · {INFRASPAWN_POLL_REQUEST_SIGNALS.length} punkter
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 rounded-xl border border-border/80 px-4 py-3">
        <ul className="space-y-2 text-sm">
          {INFRASPAWN_POLL_REQUEST_SIGNALS.map((signal) => (
            <li key={signal.equipmentTag} className="flex justify-between gap-3">
              <span>{signal.label}</span>
              <span className="font-mono text-xs text-muted-foreground">
                {signal.equipmentTag}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-3">
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium text-primary",
              SD_ANLEGG_BTN_PRESS,
            )}
            onClick={copyRequest}
          >
            {copied ? (
              <>
                <Check className="size-3.5" /> Kopiert
              </>
            ) : (
              <>
                <Copy className="size-3.5" /> Kopier
              </>
            )}
          </button>
          <a
            href={mailto}
            className={cn(
              "inline-flex items-center gap-1.5 text-xs font-medium text-primary",
              SD_ANLEGG_BTN_PRESS,
            )}
          >
            <Mail className="size-3.5" /> Send e-post
          </a>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
