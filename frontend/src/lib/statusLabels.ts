import type { IncidentStatus } from "../types";

/** Vaka durumlarinin Turkce goruntulenen adlari — birden fazla ekranda kullanilir
 * (vaka detayi zaman cizelgesi, supervizor dashboard SLA listesi vb.). */
export const STATUS_LABELS: Record<IncidentStatus, string> = {
  YENI: "Yeni",
  ATANDI: "Atandı",
  YOLDA: "Yolda",
  MUDAHALE_EDILIYOR: "Müdahale Ediliyor",
  PARCA_BEKLENIYOR: "Parça Bekleniyor",
  COZULDU: "Çözüldü",
  KAPANDI: "Kapandı",
};
