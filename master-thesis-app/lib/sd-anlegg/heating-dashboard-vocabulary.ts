type HeatingDashboardRole = "supply_temp" | "return_temp";

export type HeatingDashboardVocabularyEntry = {
  pattern: RegExp;
  dashboardRole: HeatingDashboardRole;
  dashboardWeight: number;
  unitHint?: string;
};

/**
 * Site-spesifikke dashboard-mønstre for varme (Nærbyen m.fl.).
 */
export const HEATING_DASHBOARD_VOCABULARY: readonly HeatingDashboardVocabularyEntry[] =
  [
    {
      pattern: /32000[13]OE001_turtemp/i,
      dashboardRole: "supply_temp",
      dashboardWeight: 6,
      unitHint: "degree",
    },
    {
      pattern: /320[\d.]*RT402/i,
      dashboardRole: "supply_temp",
      dashboardWeight: 5,
      unitHint: "degree",
    },
    {
      pattern: /32000[13]OE001_returtemp/i,
      dashboardRole: "return_temp",
      dashboardWeight: 6,
      unitHint: "degree",
    },
    {
      pattern: /320[\d.]*RT502/i,
      dashboardRole: "return_temp",
      dashboardWeight: 5,
      unitHint: "degree",
    },
  ];
