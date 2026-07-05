"use client";

import type { ControlLoopDiagram } from "@/lib/sd-anlegg/control/control-types";
import {
  CONTROL_ARCHITECTURE_UI,
  CONTROL_SETUP_UI,
  controlShadowContextSubline,
} from "@/lib/sd-anlegg/control/control-display-labels";
import { SdAnleggControlLoopDiagram } from "@/components/sd-anlegg/control/styring/loop-diagram";
import { SdAnleggMpcArchitectureDiagram } from "@/components/sd-anlegg/sd-anlegg-mpc-architecture-diagram";
import {
  SD_ANLEGG_CARD,
  SD_ANLEGG_SCHEMATIC_CANVAS,
  SD_ANLEGG_SCHEMATIC_SHELL,
  SD_ANLEGG_WORKSPACE_TABS_LIST,
  SD_ANLEGG_WORKSPACE_TABS_TRIGGER,
} from "@/components/sd-anlegg/sd-anlegg-ui";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = {
  buildingSlug?: string;
  unitKey: string;
  diagram: ControlLoopDiagram;
  usesMpc?: boolean;
  className?: string;
};

export function SdAnleggControlAlgorithmPanel({
  buildingSlug,
  unitKey,
  diagram,
  usesMpc = false,
  className,
}: Props) {
  const contextLine = buildingSlug ? controlShadowContextSubline(buildingSlug) : null;
  return (
    <section
      aria-label="Slik simuleres styringen"
      className={cn(SD_ANLEGG_CARD, SD_ANLEGG_SCHEMATIC_SHELL, className)}
    >
      <div className="border-b border-border/60 px-4 py-3 sm:px-5">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {CONTROL_SETUP_UI.algorithmTitle(unitKey)}
        </h2>
        {(usesMpc ? contextLine : CONTROL_SETUP_UI.algorithmLiveOnly) ? (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {usesMpc ? contextLine : CONTROL_SETUP_UI.algorithmLiveOnly}
          </p>
        ) : null}
      </div>

      {usesMpc ? (
        <Tabs defaultValue="architecture" className="gap-0">
          <div className="border-b border-border/60 px-4 py-3 sm:px-5">
            <TabsList className={SD_ANLEGG_WORKSPACE_TABS_LIST}>
              <TabsTrigger value="architecture" className={SD_ANLEGG_WORKSPACE_TABS_TRIGGER}>
                {CONTROL_ARCHITECTURE_UI.tabOverview}
              </TabsTrigger>
              <TabsTrigger value="physical" className={SD_ANLEGG_WORKSPACE_TABS_TRIGGER}>
                {CONTROL_ARCHITECTURE_UI.tabPhysical}
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent
            value="architecture"
            className={cn(SD_ANLEGG_SCHEMATIC_CANVAS, "px-4 py-5 sm:px-6 sm:py-6")}
          >
            <SdAnleggMpcArchitectureDiagram />
          </TabsContent>
          <TabsContent
            value="physical"
            className={cn(SD_ANLEGG_SCHEMATIC_CANVAS, "px-4 py-5 sm:px-6 sm:py-6")}
          >
            <SdAnleggControlLoopDiagram diagram={diagram} variant="hero" />
          </TabsContent>
        </Tabs>
      ) : (
        <div className={cn(SD_ANLEGG_SCHEMATIC_CANVAS, "px-4 py-5 sm:px-6 sm:py-6")}>
          <SdAnleggControlLoopDiagram diagram={diagram} variant="hero" />
        </div>
      )}
    </section>
  );
}
