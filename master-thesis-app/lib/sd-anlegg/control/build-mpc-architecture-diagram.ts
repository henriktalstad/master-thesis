export type MpcArchitectureNodeRole =
  | "input"
  | "constraint"
  | "mpc"
  | "legacy"
  | "evaluation";

export type MpcArchitectureNode = {
  id: string;
  label: string;
  sublabel?: string;
  role: MpcArchitectureNodeRole;
  x: number;
  y: number;
};

export type MpcArchitectureEdge = {
  from: string;
  to: string;
  label?: string;
  dashed?: boolean;
  bidirectional?: boolean;
};

export type MpcArchitectureGroup = {
  id: string;
  label: string;
  nodeIds: string[];
};

export type MpcArchitectureDiagram = {
  nodes: MpcArchitectureNode[];
  edges: MpcArchitectureEdge[];
  groups: MpcArchitectureGroup[];
};

export function buildMpcArchitectureDiagram(): MpcArchitectureDiagram {
  const nodes: MpcArchitectureNode[] = [
    {
      id: "weather",
      label: "Værprognose",
      role: "input",
      x: 84,
      y: 92,
    },
    {
      id: "price",
      label: "Spotpris",
      role: "input",
      x: 84,
      y: 152,
    },
    {
      id: "patterns",
      label: "Driftsplan",
      sublabel: "estimat",
      role: "input",
      x: 84,
      y: 212,
    },
    {
      id: "comfort",
      label: "Komfortgrenser",
      role: "constraint",
      x: 268,
      y: 52,
    },
    {
      id: "bounds",
      label: "Pådragsgrenser",
      role: "constraint",
      x: 448,
      y: 52,
    },
    {
      id: "optimizer",
      label: "Kostoptimalisering",
      sublabel: "15 min horisont",
      role: "mpc",
      x: 268,
      y: 148,
    },
    {
      id: "plant",
      label: "Kuvertmodell",
      sublabel: "avtrekkstemp.",
      role: "mpc",
      x: 448,
      y: 148,
    },
    {
      id: "projection",
      label: "Gyldige",
      sublabel: "kommandoer",
      role: "mpc",
      x: 268,
      y: 238,
    },
    {
      id: "estimator",
      label: "Tilstands-",
      sublabel: "estimat",
      role: "mpc",
      x: 448,
      y: 238,
    },
    {
      id: "local_bms",
      label: "Lokal",
      sublabel: "BMS-styring",
      role: "legacy",
      x: 588,
      y: 148,
    },
    {
      id: "database",
      label: "Målt",
      sublabel: "historikk",
      role: "legacy",
      x: 588,
      y: 238,
    },
    {
      id: "compare",
      label: "Strategi-",
      sublabel: "sammenligning",
      role: "evaluation",
      x: 358,
      y: 348,
    },
  ];

  const edges: MpcArchitectureEdge[] = [
    { from: "weather", to: "optimizer" },
    { from: "price", to: "optimizer" },
    { from: "patterns", to: "optimizer" },
    { from: "comfort", to: "optimizer" },
    { from: "bounds", to: "optimizer" },
    {
      from: "optimizer",
      to: "plant",
      bidirectional: true,
    },
    { from: "optimizer", to: "projection" },
    { from: "plant", to: "estimator" },
    {
      from: "projection",
      to: "compare",
      label: "Simulert forslag",
      dashed: true,
    },
    { from: "local_bms", to: "database" },
    {
      from: "database",
      to: "estimator",
      label: "Måling",
    },
    {
      from: "database",
      to: "compare",
      label: "Faktisk drift",
    },
  ];

  const groups: MpcArchitectureGroup[] = [
    {
      id: "inputs",
      label: "Prognoser",
      nodeIds: ["weather", "price", "patterns"],
    },
    {
      id: "constraints",
      label: "Grenser og preferanser",
      nodeIds: ["comfort", "bounds"],
    },
    {
      id: "mpc",
      label: "Simuleringsmotor",
      nodeIds: ["optimizer", "plant", "projection", "estimator"],
    },
    {
      id: "legacy",
      label: "Eksisterende anlegg",
      nodeIds: ["local_bms", "database"],
    },
    {
      id: "evaluation",
      label: "Effektanalyse",
      nodeIds: ["compare"],
    },
  ];

  return { nodes, edges, groups };
}

export const MPC_ARCHITECTURE_GROUP_BOUNDS: Record<
  string,
  { x: number; y: number; w: number; h: number; dashed?: boolean }
> = {
  inputs: { x: 16, y: 56, w: 136, h: 192 },
  constraints: { x: 168, y: 24, w: 356, h: 52 },
  mpc: { x: 168, y: 88, w: 356, h: 192 },
  legacy: { x: 536, y: 88, w: 112, h: 192 },
  evaluation: { x: 168, y: 296, w: 356, h: 88, dashed: true },
};

export const MPC_ARCHITECTURE_VIEWBOX = { w: 664, h: 400 } as const;
