import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronRight, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { FaultTypeBadge, PriorityBadge, StatusBadge } from "../../components/ui/Badge";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { OperationsMap } from "../../components/map/OperationsMap";
import { RoutePlanPanel } from "../../components/map/RoutePlanPanel";
import { ServiceNotice } from "../../components/ui/ServiceNotice";
import { useIncidents, useStations, useTeams } from "./incidentHooks";
import { SlaCountdown } from "./SlaCountdown";

export function IncidentsListPage({
  title,
  description,
  basePath,
  showMap = false,
  showTeamsOnMap = true,
  action,
}: {
  title: string;
  description?: string;
  basePath: string;
  /** Liste ustunde canli operasyon haritasi (istasyonlar + ekipler + rotalar + arac akisi). */
  showMap?: boolean;
  showTeamsOnMap?: boolean;
  action?: React.ReactNode;
}) {
  const { data: incidents, isLoading, isError, refetch } = useIncidents();
  const { data: stations } = useStations();
  const { data: teams, isError: teamsUnavailable } = useTeams(showMap && showTeamsOnMap);
  const navigate = useNavigate();

  return (
    <div>
      <PageHeader title={title} description={description} action={action} />

      {showMap && showTeamsOnMap && teamsUnavailable && (
        <ServiceNotice message="AI Service şu an erişilemiyor: ekip konumları ve otomatik atama geçici olarak devre dışı. Vakalar BELIRSIZ/ORTA olarak açılmaya devam eder ve manuel atama kuyruğuna düşer — sistemin geri kalanı tam çalışır durumda." />
      )}

      {showMap && (
        <>
          <Card className="mb-6 overflow-hidden p-0">
            <OperationsMap
              incidents={incidents ?? []}
              stations={stations ?? []}
              teams={showTeamsOnMap ? (teams ?? []) : []}
              height={420}
              zoom={11}
              onSelectIncident={(incident) => navigate(`${basePath}/${incident.id}`)}
            />
          </Card>
          <div className="mb-6">
            <RoutePlanPanel
              incidents={incidents ?? []}
              teams={showTeamsOnMap ? (teams ?? []) : []}
              title={showTeamsOnMap ? "Ekip Rota Programı" : "Rota Planım"}
              onSelectIncident={(incident) => navigate(`${basePath}/${incident.id}`)}
            />
          </div>
        </>
      )}

      <Card className="overflow-hidden">
        {isLoading && <LoadingState label="Vakalar yükleniyor..." />}
        {isError && <ErrorState message="Vakalar yüklenemedi." onRetry={() => refetch()} />}
        {!isLoading && !isError && incidents?.length === 0 && (
          <EmptyState icon={<Inbox className="h-6 w-6 text-navy-300" />} title="Henüz vaka yok" description="Yeni bir vaka oluştuğunda burada listelenecek." />
        )}
        {!isLoading && !isError && incidents && incidents.length > 0 && (
          <div className="divide-y divide-navy-100/70">
            {incidents.map((incident, i) => (
              <motion.button
                key={incident.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                onClick={() => navigate(`${basePath}/${incident.id}`)}
                className="flex w-full flex-col gap-3 px-5 py-4 text-left transition-colors hover:bg-navy-50/60 sm:flex-row sm:items-center sm:gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-mono text-sm font-semibold text-navy-900">{incident.incidentNo}</p>
                    <span className="text-xs text-navy-400">{incident.stationCode}</span>
                  </div>
                  <p className="mt-1 text-xs text-navy-400">
                    {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true, locale: tr })}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <FaultTypeBadge faultType={incident.faultType} />
                  <PriorityBadge priority={incident.priority} />
                  <StatusBadge status={incident.status} />
                </div>
                <div className="flex items-center justify-between gap-3 sm:w-28 sm:justify-end">
                  <SlaCountdown incident={incident} compact />
                  <ChevronRight className="h-4 w-4 shrink-0 text-navy-300" />
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
