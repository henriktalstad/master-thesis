import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { formatInfraspawnSyncTime } from "@/lib/infraspawn/display-format";
import type { InfraspawnSourceSyncIssue } from "@/lib/infraspawn/resolve-source-sync-issues";
import { SD_ANLEGG_BTN_PRESS } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

type Props = {
  issues: readonly InfraspawnSourceSyncIssue[];
  className?: string;
};

export function SdAnleggSyncStatusBanner({ issues, className }: Props) {
  if (issues.length === 0) return null;

  const primary = issues[0]!;

  return (
    <output
      className={cn(
        "block rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm",
        className,
      )}
    >
      <div className="flex flex-wrap items-start gap-2">
        <AlertTriangle
          className="mt-0.5 size-4 shrink-0 text-destructive"
          aria-hidden
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium text-foreground">
            Synk mot Infraspawn feilet for {primary.label}
            {issues.length > 1 ? ` (+${issues.length - 1} til)` : ""}
          </p>
          {primary.lastError ? (
            <p className="text-muted-foreground">{primary.lastError}</p>
          ) : (
            <p className="text-muted-foreground">
              Status: {primary.syncStatus ?? "ukjent"}
            </p>
          )}
          {primary.lastSuccessfulSyncAt ? (
            <p className="text-xs text-muted-foreground">
              Sist vellykket: {formatInfraspawnSyncTime(primary.lastSuccessfulSyncAt)}
            </p>
          ) : null}
        </div>
        <Link
          href="/integrasjoner/infraspawn"
          className={cn(
            SD_ANLEGG_BTN_PRESS,
            "shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline",
          )}
        >
          Integrasjon
        </Link>
      </div>
    </output>
  );
}
