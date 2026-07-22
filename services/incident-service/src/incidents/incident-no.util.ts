import { randomInt } from "crypto";

// Okunabilir, benzersiz ariza numarasi: INC-2026-000123 (bkz. case 4.1)
export function generateIncidentNo(): string {
  const year = new Date().getFullYear();
  const sequence = randomInt(0, 999999).toString().padStart(6, "0");
  return `INC-${year}-${sequence}`;
}
