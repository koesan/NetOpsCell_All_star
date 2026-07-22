import { useMemo } from "react";
import { format } from "date-fns";
import { ArrowRight, Clock3, MapPin, Route as RouteIcon, Truck, Wrench } from "lucide-react";
import type { Incident, TeamInfo } from "../../types";
import { Card, CardBody, CardHeader, CardTitle } from "../ui/Card";
import { StatusBadge } from "../ui/Badge";
import { computeTeamRoutePlans } from "../../lib/routePlan";

/**
 * Ekip rota programi paneli: haritadaki cok durakli rota planlarinin zaman cizelgesi
 * gorunumu. Her durak icin planlanan varis saati, istasyonda kalis suresi ve ayrilis
 * saati gosterilir — teknisyen kendi gununu, NOC/supervizor tum ekipleri gorur.
 * Hesap, haritayla ayni kaynaktan gelir (lib/routePlan.ts) — iki gorunum asla celismez.
 */
export function RoutePlanPanel({
  incidents,
  teams,
  title = "Ekip Rota Programı",
  onSelectIncident,
}: {
  incidents: Incident[];
  teams: TeamInfo[];
  title?: string;
  onSelectIncident?: (incident: Incident) => void;
}) {
  const plans = useMemo(() => computeTeamRoutePlans(incidents, teams), [incidents, teams]);

  if (plans.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <RouteIcon className="h-4 w-4 text-navy-300" />
      </CardHeader>
      <CardBody className="space-y-5">
        {plans.map((plan) => (
          <div key={plan.teamId}>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-navy-900 text-[11px] font-bold text-white">
                  {(plan.teamName ?? "?").charAt(0)}
                </div>
                <p className="text-sm font-semibold text-navy-900">{plan.teamName ?? plan.teamId.slice(0, 8)}</p>
              </div>
              <span className="flex items-center gap-1 text-[11px] text-navy-400">
                <Clock3 className="h-3 w-3" />
                {plan.stops.length} durak · ~{Math.max(plan.totalMinutes, 0)} dk kalan program
              </span>
            </div>

            <ol className="space-y-1.5">
              {plan.stops.map((stop) => (
                <li key={stop.incident.id}>
                  <button
                    onClick={() => onSelectIncident?.(stop.incident)}
                    disabled={!onSelectIncident}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors ${
                      stop.status === "aktif"
                        ? "border-brand-yellow/60 bg-brand-yellow/10"
                        : "border-navy-100/70 bg-white hover:bg-navy-50/60"
                    } ${onSelectIncident ? "cursor-pointer" : "cursor-default"}`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        stop.status === "aktif" ? "bg-navy-900 text-brand-yellow" : "bg-navy-100 text-navy-600"
                      }`}
                    >
                      {stop.order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-mono text-xs font-semibold text-navy-900">{stop.incident.stationCode}</span>
                        <StatusBadge status={stop.incident.status} />
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-navy-500">
                        <span className="flex items-center gap-0.5">
                          <Truck className="h-3 w-3" /> {stop.travelMinutes > 0 ? `${stop.travelMinutes} dk yol` : "sahada"}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <MapPin className="h-3 w-3" /> varış ~{format(stop.etaArrival, "HH:mm")}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Wrench className="h-3 w-3" /> ~{stop.workMinutes} dk çalışma
                        </span>
                        <span className="flex items-center gap-0.5">
                          <ArrowRight className="h-3 w-3" /> ayrılış ~{format(stop.etaDeparture, "HH:mm")}
                        </span>
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
