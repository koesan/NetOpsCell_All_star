export enum Role {
  MUSTERI = "MUSTERI",
  SAHA_TEKNISYENI = "SAHA_TEKNISYENI",
  NOC_OPERATORU = "NOC_OPERATORU",
  SUPERVIZOR = "SUPERVIZOR",
  ADMIN = "ADMIN",
}

export enum IncidentStatus {
  YENI = "YENI",
  ATANDI = "ATANDI",
  YOLDA = "YOLDA",
  MUDAHALE_EDILIYOR = "MUDAHALE_EDILIYOR",
  PARCA_BEKLENIYOR = "PARCA_BEKLENIYOR",
  COZULDU = "COZULDU",
  KAPANDI = "KAPANDI",
}

export enum FaultType {
  DONANIM = "DONANIM",
  GUC_KESINTISI = "GUC_KESINTISI",
  BAGLANTI = "BAGLANTI",
  YAZILIM = "YAZILIM",
  ISINMA = "ISINMA",
  BELIRSIZ = "BELIRSIZ",
}

export enum Priority {
  DUSUK = "DUSUK",
  ORTA = "ORTA",
  YUKSEK = "YUKSEK",
  KRITIK = "KRITIK",
}

export const SLA_HOURS: Record<Priority, number> = {
  [Priority.KRITIK]: parseInt(process.env.SLA_KRITIK_HOURS || "1", 10),
  [Priority.YUKSEK]: parseInt(process.env.SLA_YUKSEK_HOURS || "4", 10),
  [Priority.ORTA]: parseInt(process.env.SLA_ORTA_HOURS || "12", 10),
  [Priority.DUSUK]: parseInt(process.env.SLA_DUSUK_HOURS || "48", 10),
};
