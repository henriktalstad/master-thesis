"use client";

import type { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  SD_ANLEGG_CARD,
  SD_ANLEGG_CHART_SHELL,
  SD_ANLEGG_SCHEMATIC_DETAIL_EMPTY,
} from "@/components/sd-anlegg/sd-anlegg-ui";

type Props = {
  title: string;
  description?: string;
  dataCoverage?: string | null;
  children?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  chartClassName?: string;
};

export function SdAnleggControlChartCard({
  title,
  description,
  dataCoverage,
  children,
  loading = false,
  empty = false,
  emptyMessage = "Ingen data i valgt periode",
  chartClassName,
}: Props) {
  return (
    <Card className={SD_ANLEGG_CARD}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-xs text-muted-foreground">
            {description}
          </CardDescription>
        ) : null}
        {dataCoverage ? (
          <p className="text-xs text-muted-foreground">{dataCoverage}</p>
        ) : null}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div
            className={cn(
              SD_ANLEGG_CHART_SHELL,
              "flex h-[min(240px,40vh)] items-center justify-center",
              chartClassName,
            )}
          >
            <Spinner variant="ring" className="size-8 text-muted-foreground" />
          </div>
        ) : empty ? (
          <div className={cn(SD_ANLEGG_SCHEMATIC_DETAIL_EMPTY, "text-sm")}>
            {emptyMessage}
          </div>
        ) : (
          <div className={cn("min-w-0", chartClassName)}>{children}</div>
        )}
      </CardContent>
    </Card>
  );
}
