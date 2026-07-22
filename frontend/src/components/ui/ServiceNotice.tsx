import { CloudOff } from "lucide-react";

/**
 * Zarif bozulma (graceful degradation) bildirimi: bir yardimci servis (orn. AI Service)
 * gecici olarak erisilemedigin ekran CALISMAYA DEVAM EDER, yalnizca ilgili katmanin
 * eksik oldugu seffaf bicimde soylenir. Juri bagimsizlik testinde (docker stop) bu
 * bant, sistemin "cokmek" yerine bilincli sekilde bozuldugunu kanitlar.
 */
export function ServiceNotice({ message }: { message: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 animate-fade-in">
      <CloudOff className="h-4 w-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
