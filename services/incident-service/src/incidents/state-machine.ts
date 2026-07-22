import { UnprocessableEntityException } from "@nestjs/common";
import { IncidentStatus, Role } from "../common/enums/enums";

interface TransitionRule {
  allowedRoles: Role[];
}

// Bkz. ARCHITECTURE.md Bolum 4.3 (state machine). SUPERVIZOR her gecise her zaman yetkilidir
// (case: supervizor manuel atama/duzeltme yapabilir); digerleri tabloda belirtilen role ozeldir.
const TRANSITIONS: Record<string, TransitionRule> = {
  [`${IncidentStatus.YENI}->${IncidentStatus.ATANDI}`]: { allowedRoles: [Role.SUPERVIZOR] },
  [`${IncidentStatus.ATANDI}->${IncidentStatus.YOLDA}`]: { allowedRoles: [Role.SAHA_TEKNISYENI, Role.SUPERVIZOR] },
  [`${IncidentStatus.YOLDA}->${IncidentStatus.MUDAHALE_EDILIYOR}`]: {
    allowedRoles: [Role.SAHA_TEKNISYENI, Role.SUPERVIZOR],
  },
  [`${IncidentStatus.MUDAHALE_EDILIYOR}->${IncidentStatus.PARCA_BEKLENIYOR}`]: {
    allowedRoles: [Role.SAHA_TEKNISYENI, Role.SUPERVIZOR],
  },
  [`${IncidentStatus.PARCA_BEKLENIYOR}->${IncidentStatus.MUDAHALE_EDILIYOR}`]: {
    allowedRoles: [Role.SAHA_TEKNISYENI, Role.SUPERVIZOR],
  },
  [`${IncidentStatus.MUDAHALE_EDILIYOR}->${IncidentStatus.COZULDU}`]: {
    allowedRoles: [Role.SAHA_TEKNISYENI, Role.SUPERVIZOR],
  },
  [`${IncidentStatus.COZULDU}->${IncidentStatus.KAPANDI}`]: {
    allowedRoles: [Role.NOC_OPERATORU, Role.SUPERVIZOR],
  },
};

export function isValidTransition(from: IncidentStatus, to: IncidentStatus, role: Role): boolean {
  const rule = TRANSITIONS[`${from}->${to}`];
  if (!rule) return false;
  return rule.allowedRoles.includes(role);
}

export function assertValidTransition(from: IncidentStatus, to: IncidentStatus, role: Role): void {
  if (!isValidTransition(from, to, role)) {
    throw new UnprocessableEntityException(
      `${from} -> ${to} gecisi bu rol (${role}) icin gecersiz. Kural disi durum gecisi.`
    );
  }
}
