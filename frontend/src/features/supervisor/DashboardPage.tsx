import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AlertOctagon, Brain, CheckCircle, Clock, Inbox } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "../../components/ui/Card";
import { StatTile } from "../../components/ui/StatTile";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { FaultTypeBadge, PriorityBadge } from "../../components/ui/Badge";
import { IncidentMap } from "../../components/map/IncidentMap";
import { useIncidents } from "../shared/incidentHooks";
import { useAiAccuracy, useDashboardSummary } from "./dashboardHooks";
import type { FaultType, Priority } from "../../types";

const FAULT_COLORS: Record<FaultType, string> = {
  DONANIM: "#1f2f7a",
  GUC_KESINTISI: "#E4002B",
  BAGLANTI: "#0891b2",
  YAZILIM: "#7c3aed",
  ISINMA: "#FF6900",
  BELIRSIZ: "#94a3b8",
};

const PRIORITY_COLORS: Record<Priority, string> = {
  KRITIK: "#E4002B",
  YUKSEK: "#FF6900",
  ORTA: "#F5A623",
  DUSUK: "#5B7A6B",
};

const FAULT_LABELS: Record<FaultType, string> = {
  DONANIM: "Donanım",
  GUC_KESINTISI: "Güç Kesintisi",
  BAGLANTI: "Bağlantı",
  YAZILIM: "Yazılım",
  ISINMA: "Isınma",
  BELIRSIZ: "Belirsiz",
};

export function DashboardPage() {
  const { data: summary, isLoading, isError, refetch } = useDashboardSummary();
  const { data: accuracy } = useAiAccuracy();
  const { data: incidents } = useIncidents("dashboard-incidents");

  if (isLoading) return <LoadingState label="Dashboard yükleniyor..." />;
  if (isError || !summary) return <ErrorState message="Dashboard verileri yüklenemedi." onRetry={() => refetch()} />;

  const faultData = summary.faultTypeDistribution.map((d) => ({
    name: FAULT_LABELS[d.faultType],
    value: parseInt(d.count, 10),
    color: FAULT_COLORS[d.faultType],
  }));

  const priorityData = summary.priorityDistribution.map((d) => ({
    name: d.priority,
    value: parseInt(d.count, 10),
    color: PRIORITY_COLORS[d.priority],
  }));

  return (
    <div>
      <PageHeader title="Süpervizör Dashboard" description="Şebeke sağlığı ve model doğruluğu tek ekrandan." />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="SLA Uyum Oranı"
          value={`%${summary.sla.complianceRatePercent}`}
          icon={CheckCircle}
          accent="emerald"
          hint={`${summary.sla.totalResolved} çözülen vaka`}
        />
        <StatTile label="SLA Aşan Aktif Vaka" value={summary.sla.exceededActiveCount} icon={AlertOctagon} accent="kritik" />
        <StatTile
          label="AI Doğruluk Oranı"
          value={accuracy ? `%${accuracy.accuracy_percent}` : "—"}
          icon={Brain}
          accent="yellow"
          hint={accuracy ? `${accuracy.total_predictions} tahmin` : "veri bekleniyor"}
        />
        <StatTile label="Bekleyen Atama" value={summary.pendingAssignmentQueue.length} icon={Clock} accent="navy" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Arıza Türü Dağılımı</CardTitle>
          </CardHeader>
          <CardBody>
            {faultData.length === 0 ? (
              <EmptyState icon={<Inbox className="h-6 w-6 text-navy-300" />} title="Veri yok" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={faultData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {faultData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="mt-2 flex flex-wrap justify-center gap-3">
              {faultData.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs text-navy-500">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                  {d.name} ({d.value})
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Öncelik Dağılımı</CardTitle>
          </CardHeader>
          <CardBody>
            {priorityData.length === 0 ? (
              <EmptyState icon={<Inbox className="h-6 w-6 text-navy-300" />} title="Veri yok" />
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={priorityData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEF0F5" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7998" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#6b7998" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: "#F7F8FB" }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {priorityData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6 overflow-hidden p-0">
        <CardHeader className="px-5 pt-5">
          <CardTitle>Şebeke Haritası</CardTitle>
        </CardHeader>
        <div className="p-5 pt-3">
          <IncidentMap incidents={incidents ?? []} height={320} zoom={10} />
        </div>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Saha Ekibi Performansı</CardTitle>
          </CardHeader>
          <CardBody className="p-0">
            {summary.fieldTeamPerformance.length === 0 ? (
              <EmptyState title="Henüz veri yok" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-navy-100 text-left text-xs text-navy-400">
                    <th className="px-5 py-2 font-medium">Ekip</th>
                    <th className="px-5 py-2 font-medium">Çözülen</th>
                    <th className="px-5 py-2 font-medium">Ort. Süre</th>
                    <th className="px-5 py-2 font-medium">Tekrar Oranı</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.fieldTeamPerformance.map((row) => (
                    <tr key={row.teamId} className="border-b border-navy-50 last:border-0">
                      <td className="px-5 py-2.5 font-mono text-xs text-navy-600">{row.teamId.slice(0, 8)}</td>
                      <td className="px-5 py-2.5">{row.resolvedCount}</td>
                      <td className="px-5 py-2.5">{row.avgResponseSeconds ? `${Math.round(row.avgResponseSeconds / 60)} dk` : "—"}</td>
                      <td className="px-5 py-2.5">%{row.repeatRatePercent}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bekleyen Atama Kuyruğu</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-2 p-0">
            {summary.pendingAssignmentQueue.length === 0 ? (
              <EmptyState title="Kuyruk boş" description="Tüm vakalar atanmış durumda." />
            ) : (
              <div className="divide-y divide-navy-50">
                {summary.pendingAssignmentQueue.slice(0, 6).map((incident) => (
                  <div key={incident.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="font-mono text-xs font-semibold text-navy-800">{incident.incidentNo}</p>
                      <p className="text-[11px] text-navy-400">{incident.stationCode}</p>
                    </div>
                    <div className="flex gap-1.5">
                      <FaultTypeBadge faultType={incident.faultType} />
                      <PriorityBadge priority={incident.priority} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
