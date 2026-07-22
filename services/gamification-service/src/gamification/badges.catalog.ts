import { BadgeCode } from "../common/enums/enums";

// Kullanici arayuzunde gosterilir; bu yuzden dogru Turkce karakterlerle yazilir
// (kod ici loglarin aksine, bu metin dogrudan son kullaniciya sunulur).
export const BADGE_CATALOG = [
  { code: BadgeCode.ILK_MUDAHALE, name: "İlk Müdahale", condition: "İlk arızayı çözme" },
  { code: BadgeCode.HIZ_USTASI, name: "Hız Ustası", condition: "SLA'nın yarısında 10 müdahale" },
  { code: BadgeCode.KALICI_COZUM, name: "Kalıcı Çözüm", condition: "20 arızada tekrar olmadan" },
  { code: BadgeCode.MARATONCU, name: "Maratoncu", condition: "Bir günde 15 arıza çözümü" },
  { code: BadgeCode.KRIZ_YONETICISI, name: "Kriz Yöneticisi", condition: "10 KRİTİK arızayı SLA içinde çözme" },
  { code: BadgeCode.UZMAN, name: "Uzman", condition: "Tek türde 50 arıza çözümü" },
];
