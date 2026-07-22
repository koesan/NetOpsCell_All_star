import type { Incident, TeamInfo } from "../types";

/**
 * Cok durakli ekip rota planlayicisi.
 *
 * Bir ekibin uzerinde birden fazla aktif vaka varsa, ekip ussunden baslayan bir tur
 * en-yakin-komsu (nearest neighbour) sezgiseliyle siralanir ve her durak icin
 * kumulatif zaman cizelgesi cikarilir: ne zaman varilacak, istasyonda ne kadar
 * kalinacak, ne zaman ayrilinacak. Yol suresi AI Service'in ETA modeliyle AYNI
 * varsayimlari kullanir (5 dk hazirlik + mesafe x 1.35 yol kivrimi / 34 km/s) —
 * haritadaki canli arac animasyonu, durak rozetleri ve "Rota Planim" karti boylece
 * tek bir tutarli zaman modelinden beslenir.
 *
 * Devam eden bir vaka varsa (YOLDA / MUDAHALE_EDILIYOR / PARCA_BEKLENIYOR) tur o
 * vakadan baslar; ATANDI durumundakiler sonraki duraklar olarak eklenir.
 */

const ROAD_CURVE_FACTOR = 1.35;
const URBAN_AVG_SPEED_KMH = 34;
const DEPARTURE_PREP_MINUTES = 5;
const DEFAULT_WORK_MINUTES = 90;

export interface RouteStop {
  incident: Incident;
  order: number; // 1-tabanli durak sirasi
  travelMinutes: number; // onceki noktadan bu duraga surus
  workMinutes: number; // istasyonda planlanan calisma suresi
  etaArrival: Date;
  etaDeparture: Date;
  status: "aktif" | "siradaki" | "planli";
}

export interface TeamRoutePlan {
  teamId: string;
  teamName: string | null;
  origin: [number, number];
  stops: RouteStop[];
  totalMinutes: number;
}

const EN_ROUTE = new Set(["YOLDA", "MUDAHALE_EDILIYOR", "PARCA_BEKLENIYOR"]);
const PLANNABLE = new Set(["ATANDI", "YOLDA", "MUDAHALE_EDILIYOR", "PARCA_BEKLENIYOR"]);

function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function travelMinutes(from: [number, number], to: [number, number]): number {
  const roadKm = haversineKm(from, to) * ROAD_CURVE_FACTOR;
  return Math.round(DEPARTURE_PREP_MINUTES + (roadKm / URBAN_AVG_SPEED_KMH) * 60);
}

/** Ekip basina cok durakli rota plani hesaplar (yalnizca koordinati olan aktif vakalar). */
export function computeTeamRoutePlans(incidents: Incident[], teams: TeamInfo[]): TeamRoutePlan[] {
  const byTeam = new Map<string, Incident[]>();
  for (const incident of incidents) {
    if (!incident.assignedTeamId || !PLANNABLE.has(incident.status)) continue;
    if (incident.latitude == null || incident.longitude == null) continue;
    const list = byTeam.get(incident.assignedTeamId) ?? [];
    list.push(incident);
    byTeam.set(incident.assignedTeamId, list);
  }

  const plans: TeamRoutePlan[] = [];
  for (const [teamId, teamIncidents] of byTeam) {
    const team = teams.find((t) => t.team_id === teamId);
    const first = teamIncidents[0];
    const origin: [number, number] | null =
      team?.lat != null && team?.lng != null
        ? [team.lat, team.lng]
        : first.assignedTeamLat != null && first.assignedTeamLng != null
          ? [first.assignedTeamLat, first.assignedTeamLng]
          : null;
    if (!origin) continue;

    // Devam eden vaka (varsa) zorunlu ilk durak; kalanlar en-yakin-komsu ile siralanir
    const active = teamIncidents.filter((i) => EN_ROUTE.has(i.status));
    const pending = teamIncidents.filter((i) => !EN_ROUTE.has(i.status));
    const ordered: Incident[] = [...active];
    let cursor: [number, number] = ordered.length
      ? [ordered[ordered.length - 1].latitude!, ordered[ordered.length - 1].longitude!]
      : origin;
    const remaining = [...pending];
    while (remaining.length) {
      remaining.sort(
        (a, b) =>
          haversineKm(cursor, [a.latitude!, a.longitude!]) - haversineKm(cursor, [b.latitude!, b.longitude!])
      );
      const next = remaining.shift()!;
      ordered.push(next);
      cursor = [next.latitude!, next.longitude!];
    }

    // Kumulatif zaman cizelgesi
    const stops: RouteStop[] = [];
    let clock = new Date();
    let prev: [number, number] = origin;
    ordered.forEach((incident, index) => {
      const target: [number, number] = [incident.latitude!, incident.longitude!];
      const work = Math.round(incident.etaWorkMinutes ?? DEFAULT_WORK_MINUTES);
      let travel = Math.round(incident.etaTravelMinutes ?? travelMinutes(prev, target));

      let arrival: Date;
      if (incident.status === "MUDAHALE_EDILIYOR" || incident.status === "PARCA_BEKLENIYOR") {
        travel = 0;
        arrival = incident.arrivedAt ? new Date(incident.arrivedAt) : clock;
        const departure = new Date(arrival.getTime() + work * 60000);
        clock = departure > clock ? departure : clock;
        stops.push({ incident, order: index + 1, travelMinutes: 0, workMinutes: work, etaArrival: arrival, etaDeparture: departure, status: "aktif" });
      } else if (incident.status === "YOLDA") {
        const departed = incident.departedAt ? new Date(incident.departedAt) : clock;
        arrival = new Date(departed.getTime() + travel * 60000);
        if (arrival < clock) arrival = clock;
        const departure = new Date(arrival.getTime() + work * 60000);
        clock = departure;
        stops.push({ incident, order: index + 1, travelMinutes: travel, workMinutes: work, etaArrival: arrival, etaDeparture: departure, status: "aktif" });
      } else {
        travel = travelMinutes(prev, target);
        arrival = new Date(clock.getTime() + travel * 60000);
        const departure = new Date(arrival.getTime() + work * 60000);
        clock = departure;
        stops.push({
          incident,
          order: index + 1,
          travelMinutes: travel,
          workMinutes: work,
          etaArrival: arrival,
          etaDeparture: departure,
          status: index === 0 ? "siradaki" : "planli",
        });
      }
      prev = target;
    });

    plans.push({
      teamId,
      teamName: team?.name ?? first.assignedTeamName,
      origin,
      stops,
      totalMinutes: Math.round((clock.getTime() - Date.now()) / 60000),
    });
  }

  return plans;
}
