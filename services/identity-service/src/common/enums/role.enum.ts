export enum Role {
  MUSTERI = "MUSTERI",
  SAHA_TEKNISYENI = "SAHA_TEKNISYENI",
  NOC_OPERATORU = "NOC_OPERATORU",
  SUPERVIZOR = "SUPERVIZOR",
  ADMIN = "ADMIN",
}

// Yetki matrisinde "Personel" sutunu bu iki rolun ortak izinlerini temsil eder (bkz. ARCHITECTURE.md Bolum 4.2)
export const PERSONEL_ROLES = [Role.SAHA_TEKNISYENI, Role.NOC_OPERATORU];

export enum FaultType {
  DONANIM = "DONANIM",
  GUC_KESINTISI = "GUC_KESINTISI",
  BAGLANTI = "BAGLANTI",
  YAZILIM = "YAZILIM",
  ISINMA = "ISINMA",
}
