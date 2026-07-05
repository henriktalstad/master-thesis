import "server-only";

import { prisma } from "@/lib/db";
import {
  monthRangesBetween,
  type GridTariffRow,
} from "./grid-tariff-monthly";
import { primaryEnergyTariffGroup } from "./grid-tariff-groups";

export type GridTariffMarginalContext = {
  operatorId: string;
  county: string;
  tariffGroup: number;
};

export {
  ELECTRICITY_CONSUMPTION_TAX_KR,
  gridMarginalAddonKrPerKwh,
  gridOreForHour,
} from "./grid-tariff-marginal-utils";

export { monthRangesBetween } from "./grid-tariff-monthly";

export async function resolveGridTariffMarginalContext(
  buildingId: string,
): Promise<GridTariffMarginalContext | null> {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: {
      selectedGridOperatorId: true,
      selectedGridOperator: { select: { counties: true } },
    },
  });
  if (!building?.selectedGridOperatorId) return null;

  const county = building.selectedGridOperator?.counties?.[0];
  if (!county) return null;

  const tariffGroup = primaryEnergyTariffGroup();

  return {
    operatorId: building.selectedGridOperatorId,
    county,
    tariffGroup,
  };
}

async function fetchGridTariffRows(input: {
  context: GridTariffMarginalContext;
  since: Date;
  until: Date;
}): Promise<GridTariffRow[]> {
  return prisma.gridTariff.findMany({
    where: {
      gridOperatorId: input.context.operatorId,
      county: input.context.county,
      tariffGroup: input.context.tariffGroup,
      OR: monthRangesBetween(input.since, input.until),
    },
    select: { timestamp: true, energyLink: true, capacityLink: true, fixedLink: true },
  });
}

export async function loadGridEnergyOreByHour(input: {
  context: GridTariffMarginalContext;
  since: Date;
  until: Date;
}): Promise<Map<string, number>> {
  const tariffs = await fetchGridTariffRows(input);
  return new Map(
    tariffs.map((row) => [row.timestamp.toISOString(), row.energyLink ?? 0]),
  );
}
