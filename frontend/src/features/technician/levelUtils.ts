import type { Level } from "../../types";

const TIERS: { level: Level; min: number; max: number | null }[] = [
  { level: "BRONZ", min: 0, max: 499 },
  { level: "GUMUS", min: 500, max: 1499 },
  { level: "ALTIN", min: 1500, max: 2999 },
  { level: "PLATIN", min: 3000, max: null },
];

export const LEVEL_LABELS: Record<Level, string> = {
  BRONZ: "Bronz",
  GUMUS: "Gümüş",
  ALTIN: "Altın",
  PLATIN: "Platin",
};

export const LEVEL_COLORS: Record<Level, string> = {
  BRONZ: "#B08D57",
  GUMUS: "#9CA3AF",
  ALTIN: "#F5A623",
  PLATIN: "#7DD3FC",
};

export function levelProgress(points: number): { percent: number; nextThreshold: number | null } {
  const tier = TIERS.find((t) => points >= t.min && (t.max === null || points <= t.max))!;
  if (tier.max === null) return { percent: 100, nextThreshold: null };
  const percent = Math.round(((points - tier.min) / (tier.max + 1 - tier.min)) * 100);
  return { percent, nextThreshold: tier.max + 1 };
}
