import {
  ClipboardList,
  Gauge,
  LayoutDashboard,
  ListChecks,
  PlusCircle,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import type { Role } from "../../types";

export interface NavItem {
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
}

export const NAV_CONFIG: Record<Role, NavItem[]> = {
  MUSTERI: [
    { label: "Arıza Bildir", path: "/musteri/yeni-ariza", icon: PlusCircle },
    { label: "Vakalarım", path: "/musteri/vakalarim", icon: ClipboardList },
  ],
  SAHA_TEKNISYENI: [
    { label: "Vakalarım", path: "/saha/vakalarim", icon: ListChecks },
    { label: "Profilim", path: "/saha/profil", icon: Trophy },
  ],
  NOC_OPERATORU: [
    { label: "Vakalar", path: "/operasyon/vakalar", icon: ClipboardList },
    { label: "Liderlik Tablosu", path: "/operasyon/liderlik", icon: Trophy },
  ],
  SUPERVIZOR: [
    { label: "Dashboard", path: "/operasyon/dashboard", icon: LayoutDashboard },
    { label: "Vakalar", path: "/operasyon/vakalar", icon: ClipboardList },
    { label: "Liderlik Tablosu", path: "/operasyon/liderlik", icon: Trophy },
  ],
  ADMIN: [
    { label: "Personel", path: "/yonetim/personel", icon: Users },
    { label: "Audit Log", path: "/yonetim/audit-log", icon: ShieldCheck },
  ],
};

export const ROLE_LABELS: Record<Role, string> = {
  MUSTERI: "Müşteri",
  SAHA_TEKNISYENI: "Saha Teknisyeni",
  NOC_OPERATORU: "NOC Operatörü",
  SUPERVIZOR: "Süpervizör",
  ADMIN: "Sistem Yöneticisi",
};

export const ROLE_ICON: Record<Role, typeof Gauge> = {
  MUSTERI: Gauge,
  SAHA_TEKNISYENI: ListChecks,
  NOC_OPERATORU: ClipboardList,
  SUPERVIZOR: LayoutDashboard,
  ADMIN: ShieldCheck,
};
