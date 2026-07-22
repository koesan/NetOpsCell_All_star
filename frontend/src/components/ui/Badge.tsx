import type { HTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import type { FaultType, IncidentStatus, Priority } from "../../types";

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium leading-none",
        className
      )}
      {...props}
    />
  );
}

const PRIORITY_STYLES: Record<Priority, string> = {
  KRITIK: "bg-red-50 text-priority-kritik ring-1 ring-inset ring-red-200",
  YUKSEK: "bg-orange-50 text-priority-yuksek ring-1 ring-inset ring-orange-200",
  ORTA: "bg-amber-50 text-priority-orta ring-1 ring-inset ring-amber-200",
  DUSUK: "bg-emerald-50 text-priority-dusuk ring-1 ring-inset ring-emerald-200",
};

const PRIORITY_LABELS: Record<Priority, string> = {
  KRITIK: "Kritik",
  YUKSEK: "Yüksek",
  ORTA: "Orta",
  DUSUK: "Düşük",
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <Badge className={PRIORITY_STYLES[priority]}>{PRIORITY_LABELS[priority]}</Badge>;
}

const STATUS_STYLES: Record<IncidentStatus, string> = {
  YENI: "bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200",
  ATANDI: "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200",
  YOLDA: "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200",
  MUDAHALE_EDILIYOR: "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200",
  PARCA_BEKLENIYOR: "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200",
  COZULDU: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  KAPANDI: "bg-navy-100 text-navy-700 ring-1 ring-inset ring-navy-200",
};

const STATUS_LABELS: Record<IncidentStatus, string> = {
  YENI: "Yeni",
  ATANDI: "Atandı",
  YOLDA: "Yolda",
  MUDAHALE_EDILIYOR: "Müdahale Ediliyor",
  PARCA_BEKLENIYOR: "Parça Bekleniyor",
  COZULDU: "Çözüldü",
  KAPANDI: "Kapandı",
};

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return <Badge className={STATUS_STYLES[status]}>{STATUS_LABELS[status]}</Badge>;
}

const FAULT_TYPE_LABELS: Record<FaultType, string> = {
  DONANIM: "Donanım",
  GUC_KESINTISI: "Güç Kesintisi",
  BAGLANTI: "Bağlantı",
  YAZILIM: "Yazılım",
  ISINMA: "Isınma",
  BELIRSIZ: "Belirsiz",
};

export function FaultTypeBadge({ faultType }: { faultType: FaultType }) {
  return <Badge className="bg-navy-50 text-navy-700 ring-1 ring-inset ring-navy-200">{FAULT_TYPE_LABELS[faultType]}</Badge>;
}
