"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ClipboardList } from "lucide-react";
import { buildAhuPresentationModel } from "@/lib/sd-anlegg/ahu-equipment-identification";
import type { InfraspawnPointListItem } from "@/lib/infraspawn/types";
import { Button } from "@/components/ui/button";
import { SD_ANLEGG_BTN_PRESS, SD_ANLEGG_INFO_BANNER } from "@/components/sd-anlegg/sd-anlegg-ui";
import { useSdAnleggEffectiveIdentification } from "./use-sd-anlegg-effective-identification";
import { SdAnleggSignalOnboardingPanel } from "./sd-anlegg-signal-onboarding-panel";

type DomainUnitOption = {
  scopeId: string;
  displayName: string;
};

const EMPTY_DOMAIN_UNITS: readonly DomainUnitOption[] = [];

type Props = {
  buildingSlug: string;
  points: readonly InfraspawnPointListItem[];
  elementKey?: string | null;
  domainUnits?: readonly DomainUnitOption[];
  canEdit: boolean;
};

export function SdAnleggSignalOnboardingBanner({
  buildingSlug,
  points,
  elementKey,
  domainUnits = EMPTY_DOMAIN_UNITS,
  canEdit,
}: Props) {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(
    () => searchParams.get("signalReview") === "1",
  );
  const { schemaSlotOverrides } = useSdAnleggEffectiveIdentification();

  const summary = useMemo(() => {
    if (points.length === 0) return null;
    return buildAhuPresentationModel(points, {
      elementKey: elementKey ?? null,
      schemaSlotOverrides,
    }).summary;
  }, [points, elementKey, schemaSlotOverrides]);

  if (!canEdit || !summary || summary.missing === 0) return null;

  return (
    <>
      <output className={SD_ANLEGG_INFO_BANNER}>
        <span>
          {summary.missing} utstyrsslotter mangler binding ({summary.coveragePct}{" "}
          % koblet). Rett navn og beskrivelse for bedre skjema.
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={`ml-3 shrink-0 ${SD_ANLEGG_BTN_PRESS}`}
          onClick={() => setOpen(true)}
        >
          <ClipboardList className="size-3.5" aria-hidden />
          Kartlegg signaler
        </Button>
      </output>

      <SdAnleggSignalOnboardingPanel
        buildingSlug={buildingSlug}
        points={points}
        elementKey={elementKey}
        domainUnits={domainUnits}
        open={open}
        onOpenChangeAction={setOpen}
      />
    </>
  );
}
