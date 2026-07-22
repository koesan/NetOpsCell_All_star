export enum Role {
  MUSTERI = "MUSTERI",
  SAHA_TEKNISYENI = "SAHA_TEKNISYENI",
  NOC_OPERATORU = "NOC_OPERATORU",
  SUPERVIZOR = "SUPERVIZOR",
  ADMIN = "ADMIN",
}

export enum Level {
  BRONZ = "BRONZ",
  GUMUS = "GUMUS",
  ALTIN = "ALTIN",
  PLATIN = "PLATIN",
}

export function levelForPoints(points: number): Level {
  if (points >= 3000) return Level.PLATIN;
  if (points >= 1500) return Level.ALTIN;
  if (points >= 500) return Level.GUMUS;
  return Level.BRONZ;
}

export const POINTS = {
  INCIDENT_RESOLVED: 10,
  FAST_RESPONSE_BONUS: 5,
  PERMANENT_FIX_BONUS: 10,
  CRITICAL_WITHIN_SLA_BONUS: 15,
  SLA_EXCEEDED_PENALTY: -5,
  REPEATED_INCIDENT_PENALTY: -3,
};

export enum BadgeCode {
  ILK_MUDAHALE = "ILK_MUDAHALE",
  HIZ_USTASI = "HIZ_USTASI",
  KALICI_COZUM = "KALICI_COZUM",
  MARATONCU = "MARATONCU",
  KRIZ_YONETICISI = "KRIZ_YONETICISI",
  UZMAN = "UZMAN",
}
