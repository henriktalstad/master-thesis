"use client";

import { Radio } from "lucide-react";
import type { InfraspawnSystemDomain } from "@/lib/infraspawn/system-domain";
import type { DomainPointListFilterId } from "@/lib/infraspawn/domain-point-list-filters";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import type { SchemaTemplate } from "@/lib/sd-anlegg/schema-templates/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SD_ANLEGG_CARD } from "@/components/sd-anlegg/sd-anlegg-ui";
import { SdAnleggPointTable } from "./sd-anlegg-point-table";

type Props = {
  buildingSlug: string;
  points: InfraspawnPointListItem[];
  domain?: InfraspawnSystemDomain;
  schemaTemplate?: SchemaTemplate | null;
  elementKey?: string | null;
  search: string;
  onSearchChangeAction: (value: string) => void;
  category: DomainPointListFilterId;
  onCategoryChangeAction: (category: DomainPointListFilterId) => void;
  selectedKeys: string[];
  onToggleAction: (point: InfraspawnPointListItem) => void;
  onSetSelectedKeysAction: (keys: string[]) => void;
};

export function SdAnleggPointsCard({
  buildingSlug,
  points,
  domain,
  schemaTemplate,
  elementKey,
  search,
  onSearchChangeAction,
  category,
  onCategoryChangeAction,
  selectedKeys,
  onToggleAction,
  onSetSelectedKeysAction,
}: Props) {
  return (
    <Card className={SD_ANLEGG_CARD}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Radio className="size-4 text-primary" aria-hidden />
          <CardTitle className="text-base">Signaler</CardTitle>
        </div>
        <CardDescription className="text-foreground/70">
          {points.length.toLocaleString("nb-NO")} målte signaler — velg for graf
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SdAnleggPointTable
          buildingSlug={buildingSlug}
          points={points}
          domain={domain}
          schemaTemplate={schemaTemplate}
          elementKey={elementKey}
          search={search}
          onSearchChangeAction={onSearchChangeAction}
          category={category}
          onCategoryChangeAction={onCategoryChangeAction}
          selectedKeys={selectedKeys}
          onToggleAction={onToggleAction}
          onSetSelectedKeysAction={onSetSelectedKeysAction}
        />
      </CardContent>
    </Card>
  );
}
