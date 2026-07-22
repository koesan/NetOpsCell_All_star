import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-navy-400", className)} />;
}

export function LoadingState({ label = "Yükleniyor..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-navy-400 animate-fade-in">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ message = "Bir şeyler ters gitti.", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center animate-fade-in">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="h-6 w-6 text-priority-kritik" />
      </div>
      <p className="max-w-xs text-sm text-navy-600">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-sm font-medium text-navy-900 underline underline-offset-2 hover:text-navy-700">
          Tekrar dene
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title = "Kayıt bulunamadı",
  description,
  icon,
  action,
}: {
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-center animate-fade-in">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-navy-50">
        {icon ?? <Inbox className="h-6 w-6 text-navy-300" />}
      </div>
      <p className="text-sm font-medium text-navy-700">{title}</p>
      {description && <p className="max-w-xs text-xs text-navy-400">{description}</p>}
      {action}
    </div>
  );
}
