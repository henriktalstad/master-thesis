import type { ReactNode } from "react";

/** Sentrerer segment-feil i hovedkolonnen (under header). */
export function SegmentErrorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[min(60vh,32rem)] w-full flex-1 items-center justify-center px-4 py-8">
      {children}
    </div>
  );
}
