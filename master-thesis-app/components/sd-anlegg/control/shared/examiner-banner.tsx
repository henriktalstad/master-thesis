import { CONTROL_EXAMINER_MODE } from "@/lib/sd-anlegg/control/control-display-labels";
import { SD_ANLEGG_INFO_BANNER } from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";

export function SdAnleggControlExaminerBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        SD_ANLEGG_INFO_BANNER,
        "rounded-lg border border-sky-500/25 bg-sky-500/8 px-3 py-2 text-[12px] leading-relaxed text-foreground/90",
        className,
      )}
      role="note"
    >
      <p className="font-medium text-foreground">{CONTROL_EXAMINER_MODE.bannerTitle}</p>
      <p className="mt-1 text-muted-foreground">{CONTROL_EXAMINER_MODE.bannerBody}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        {CONTROL_EXAMINER_MODE.thesisSnapshotNote}
      </p>
    </div>
  );
}
