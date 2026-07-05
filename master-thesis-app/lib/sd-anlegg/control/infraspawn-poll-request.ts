/** SD-signaler som bør poll-es inn i Influx for full 360.102-modell. */
export const INFRASPAWN_POLL_REQUEST_SIGNALS = [
  {
    equipmentTag: "360102_KA401_S",
    label: "Spjeld inntak (status)",
    role: "ventilasjon",
  },
  {
    equipmentTag: "360102_KA501_S",
    label: "Spjeld avkast (status)",
    role: "ventilasjon",
  },
  {
    equipmentTag: "360102_LX471_C",
    label: "Pådrag gjenvinner (VGX)",
    role: "ventilasjon",
  },
  {
    equipmentTag: "360102_LX471_A",
    label: "Alarm gjenvinner",
    role: "ventilasjon",
  },
  {
    equipmentTag: "360102_UR",
    label: "Tidsprogram",
    role: "drift",
  },
  {
    equipmentTag: "360102_FORLENGET DRIFT",
    label: "Forlenget drift",
    role: "drift",
  },
  {
    equipmentTag: "360102_Plantmode_KV",
    label: "Anleggsmodus",
    role: "drift",
  },
] as const;

export function formatInfraspawnPollRequestMarkdown(
  buildingName: string,
  unitKey: string,
): string {
  const lines = INFRASPAWN_POLL_REQUEST_SIGNALS.map(
    (s) => `- \`${s.equipmentTag}\` — ${s.label} (${s.role})`,
  );
  return [
    `Poll-forespørsel for ${buildingName} (${unitKey})`,
    "",
    "Følgende signaler finnes i anlegget men mangler i SD-eksporten:",
    "",
    ...lines,
  ].join("\n");
}

export function formatInfraspawnPollMailto(
  buildingName: string,
  unitKey: string,
): string {
  const subject = encodeURIComponent(
    `Poll SD-signaler — ${buildingName} (${unitKey})`,
  );
  const body = encodeURIComponent(
    formatInfraspawnPollRequestMarkdown(buildingName, unitKey),
  );
  return `mailto:?subject=${subject}&body=${body}`;
}
