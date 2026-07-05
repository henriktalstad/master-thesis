import { cn } from "@/lib/utils";
import { SD_ANLEGG_PROCESS_TAG } from "./styles/process-schematic-styles";
import { SdSchematicSymbol } from "./sd-schematic-symbol";

type SymbolProps = {
  className?: string;
};

/** Statisk utjevningstank (ingen BACnet-tag). */
export function HeatingExpansionTankSymbol({ className }: SymbolProps) {
  return (
    <svg viewBox="0 0 32 48" className={cn("text-foreground", className)} aria-hidden>
      <ellipse
        cx="16"
        cy="10"
        rx="11"
        ry="4.5"
        fill="currentColor"
        fillOpacity="0.1"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5 10 V34 C5 40 27 40 27 34 V10"
        fill="currentColor"
        fillOpacity="0.08"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <line x1="8" y1="42" x2="8" y2="46" stroke="currentColor" strokeWidth="2" />
      <line x1="24" y1="42" x2="24" y2="46" stroke="currentColor" strokeWidth="2" />
      <line x1="6" y1="46" x2="26" y2="46" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

type HeatExchangerProps = {
  label: string;
  className?: string;
};

export function HeatingHeatExchangerAssembly({ label, className }: HeatExchangerProps) {
  return (
    <div className={cn("flex flex-col items-center gap-1", className)}>
      <span className={cn(SD_ANLEGG_PROCESS_TAG, "max-w-[5rem] truncate text-[0.72em]")}>
        {label}
      </span>
      <div className="flex items-end justify-center gap-1">
        <SdSchematicSymbol
          type="ventilation.heat_recovery"
          style="process"
          className="h-[3.75rem] w-[1.85rem] shrink-0 text-foreground"
        />
        <HeatingExpansionTankSymbol className="mb-1 h-[2.35rem] w-[1.25rem] shrink-0 opacity-90" />
      </div>
    </div>
  );
}
