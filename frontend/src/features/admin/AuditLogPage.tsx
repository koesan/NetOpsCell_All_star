import { format } from "date-fns";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { cn } from "../../lib/cn";
import { useAuditLogs } from "./adminHooks";

export function AuditLogPage() {
  const { data: logs, isLoading, isError, refetch } = useAuditLogs();

  return (
    <div>
      <PageHeader title="Audit Log" description="Tüm kimlik doğrulama ve yetkilendirme olayları." />

      <Card>
        {isLoading && <LoadingState />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && logs?.length === 0 && (
          <EmptyState icon={<ShieldAlert className="h-6 w-6 text-navy-300" />} title="Henüz kayıt yok" />
        )}
        {!isLoading && !isError && logs && logs.length > 0 && (
          <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-navy-100 text-left text-xs text-navy-400">
                  <th className="px-5 py-3 font-medium">Zaman</th>
                  <th className="px-5 py-3 font-medium">İşlem</th>
                  <th className="px-5 py-3 font-medium">Sonuç</th>
                  <th className="px-5 py-3 font-medium">IP</th>
                  <th className="px-5 py-3 font-medium">Detay</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-navy-50 last:border-0 hover:bg-navy-50/40">
                    <td className="px-5 py-3 text-xs text-navy-500">{format(new Date(log.timestamp), "dd.MM.yyyy HH:mm:ss")}</td>
                    <td className="px-5 py-3 font-medium text-navy-800">{log.actionType}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          log.result === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-priority-kritik"
                        )}
                      >
                        {log.result === "SUCCESS" ? "Başarılı" : "Başarısız"}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-navy-400">{log.ip ?? "—"}</td>
                    <td className="max-w-xs truncate px-5 py-3 text-xs text-navy-400">{log.detail ? JSON.stringify(log.detail) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
