import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { format } from "date-fns";
import { Expand, Locate, Shrink } from "lucide-react";
import type { Incident, Priority, Station, TeamInfo } from "../../types";
import { FaultTypeBadge, PriorityBadge, StatusBadge } from "../ui/Badge";
import { computeTeamRoutePlans, type TeamRoutePlan } from "../../lib/routePlan";

/**
 * Turkcell NetOpsCell Operasyon Haritasi.
 *
 * Katmanlar: baz istasyonlari, saha ekipleri (us + anlik is yuku), oncelik renkli
 * nabiz animasyonlu vakalar ve EKIP BASINA COK DURAKLI ROTA PLANLARI (lib/routePlan.ts).
 * Bir ekibin uzerinde birden fazla vaka varsa duraklar sirali rozetlerle (1,2,3...)
 * gosterilir; her duragin planlanan varis saati ve istasyonda kalis suresi tooltip'tedir.
 * YOLDA ekipler icin arac ikonu, departedAt + ETA yol suresine gore rota uzerinde CANLI
 * ilerler — deterministik hesap sayesinde tum istemciler ayni konumu gorur.
 *
 * Rota geometrisi: OSRM public API (bellek ici cache); erisilemezse kus ucusu kavisli
 * (bezier) cizgiye zarif dusus.
 */

const PRIORITY_COLORS: Record<Priority, string> = {
  KRITIK: "#E4002B",
  YUKSEK: "#FF6900",
  ORTA: "#F5A623",
  DUSUK: "#5B7A6B",
};

const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

type LatLng = [number, number];

// ---------------------------------------------------------------------------
// Geometri yardimcilari
// ---------------------------------------------------------------------------

function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** OSRM erisilemezse: ardisik noktalar arasi hafif kavisli bezier zinciri. */
function fallbackArc(points: LatLng[]): LatLng[] {
  const out: LatLng[] = [];
  for (let p = 0; p < points.length - 1; p++) {
    const from = points[p];
    const to = points[p + 1];
    const mid: LatLng = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
    const control: LatLng = [mid[0] + (to[1] - from[1]) * 0.15, mid[1] - (to[0] - from[0]) * 0.15];
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      out.push([
        (1 - t) ** 2 * from[0] + 2 * (1 - t) * t * control[0] + t ** 2 * to[0],
        (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * control[1] + t ** 2 * to[1],
      ]);
    }
  }
  return out.length ? out : points;
}

/** Rota uzerinde [0,1] ilerleme oranina karsilik gelen nokta (kumulatif mesafe ile). */
function pointAlongRoute(route: LatLng[], progress: number): LatLng {
  if (route.length === 0) return [41.0082, 28.9784];
  if (route.length === 1 || progress <= 0) return route[0];
  if (progress >= 1) return route[route.length - 1];
  const segments: number[] = [];
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const d = haversineKm(route[i - 1], route[i]);
    segments.push(d);
    total += d;
  }
  if (total === 0) return route[0];
  let target = total * progress;
  for (let i = 0; i < segments.length; i++) {
    if (target <= segments[i]) {
      const t = segments[i] === 0 ? 0 : target / segments[i];
      return [
        route[i][0] + (route[i + 1][0] - route[i][0]) * t,
        route[i][1] + (route[i + 1][1] - route[i][1]) * t,
      ];
    }
    target -= segments[i];
  }
  return route[route.length - 1];
}

// OSRM cok durakli rota cache'i (modul seviyesi)
const routeCache = new Map<string, LatLng[]>();

async function fetchRoadRoute(waypoints: LatLng[]): Promise<LatLng[]> {
  if (waypoints.length < 2) return waypoints;
  const key = waypoints.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join("-");
  const cached = routeCache.get(key);
  if (cached) return cached;
  try {
    const coords = waypoints.map((p) => `${p[1]},${p[0]}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`OSRM ${response.status}`);
    const json = await response.json();
    const geometry: [number, number][] = json?.routes?.[0]?.geometry?.coordinates ?? [];
    if (geometry.length < 2) throw new Error("OSRM bos rota");
    const route = geometry.map(([lng, lat]) => [lat, lng] as LatLng);
    routeCache.set(key, route);
    return route;
  } catch {
    const arc = fallbackArc(waypoints);
    routeCache.set(key, arc);
    return arc;
  }
}

// ---------------------------------------------------------------------------
// Marker ikonlari (divIcon + inline SVG)
// ---------------------------------------------------------------------------

function stationIcon(hasActiveIncident: boolean): L.DivIcon {
  const color = hasActiveIncident ? "#E4002B" : "#4a5da3";
  return L.divIcon({
    className: "",
    html: `<div class="nops-station${hasActiveIncident ? " nops-station-alert" : ""}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round">
        <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9M7.8 4.7a6.14 6.14 0 0 0-.8 7.5M16.2 4.8c1.8 2 2.1 5.2.7 7.4M19.1 1.9c3.9 3.9 3.9 10.3 0 14.2M12 9v13M9.5 22h5"/>
        <circle cx="12" cy="9" r="2" fill="${color}" stroke="none"/>
      </svg></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function incidentIcon(priority: Priority): L.DivIcon {
  const color = PRIORITY_COLORS[priority];
  return L.divIcon({
    className: "",
    html: `<div class="nops-incident" style="--marker-color:${color}"><span class="nops-incident-ring"></span><span class="nops-incident-dot"></span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

function stopOrderIcon(order: number, color: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="nops-stop-order" style="--marker-color:${color}">${order}</div>`,
    iconSize: [18, 18],
    iconAnchor: [-4, 22],
  });
}

function teamIcon(available: boolean, label: string): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="nops-team${available ? "" : " nops-team-busy"}">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
      </svg>
      <span class="nops-team-label">${label}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function vehicleIcon(moving: boolean): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<div class="nops-vehicle${moving ? " nops-vehicle-moving" : ""}">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10 17h4V5H2v12h3M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5v8h1"/>
        <circle cx="7.5" cy="17.5" r="2"/><circle cx="17.5" cy="17.5" r="2"/>
      </svg></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// ---------------------------------------------------------------------------
// Bilesen
// ---------------------------------------------------------------------------

export interface OperationsMapProps {
  incidents: Incident[];
  stations?: Station[];
  teams?: TeamInfo[];
  height?: number | string;
  center?: LatLng;
  zoom?: number;
  /** Ekip basina cok durakli rota plani + canli arac katmani. */
  showRoutes?: boolean;
  onSelectIncident?: (incident: Incident) => void;
}

export function OperationsMap({
  incidents,
  stations = [],
  teams = [],
  height = 380,
  center,
  zoom = 11,
  showRoutes = true,
  onSelectIncident,
}: OperationsMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showStations, setShowStations] = useState(true);
  const [showTeams, setShowTeams] = useState(true);
  const [routes, setRoutes] = useState<Record<string, LatLng[]>>({});
  const [legRoutes, setLegRoutes] = useState<Record<string, LatLng[]>>({});
  // Canli akis saati: arac konumlari periyodik yeniden hesaplanir
  const [now, setNow] = useState(() => Date.now());

  const incidentsWithCoords = useMemo(
    () => incidents.filter((i) => i.latitude != null && i.longitude != null),
    [incidents]
  );

  // Ekip basina cok durakli rota planlari (siralama + zaman cizelgesi)
  const plans = useMemo(
    () => (showRoutes ? computeTeamRoutePlans(incidentsWithCoords, teams) : []),
    [incidentsWithCoords, teams, showRoutes]
  );

  const hasMovingVehicle = plans.some((p) => p.stops.some((s) => s.incident.status === "YOLDA"));

  useEffect(() => {
    if (!hasMovingVehicle) return;
    const timer = setInterval(() => setNow(Date.now()), 1500);
    return () => clearInterval(timer);
  }, [hasMovingVehicle]);

  // Plan rotalarini (cok durakli) ve YOLDA bacagi icin ayri leg rotasini asenkron cek
  useEffect(() => {
    let cancelled = false;
    plans.forEach((plan) => {
      const waypoints: LatLng[] = [plan.origin, ...plan.stops.map((s) => [s.incident.latitude!, s.incident.longitude!] as LatLng)];
      fetchRoadRoute(waypoints).then((route) => {
        if (!cancelled) setRoutes((prev) => (prev[plan.teamId] === route ? prev : { ...prev, [plan.teamId]: route }));
      });

      const yoldaIndex = plan.stops.findIndex((s) => s.incident.status === "YOLDA");
      if (yoldaIndex >= 0) {
        const prevPoint: LatLng =
          yoldaIndex === 0
            ? plan.origin
            : [plan.stops[yoldaIndex - 1].incident.latitude!, plan.stops[yoldaIndex - 1].incident.longitude!];
        const target: LatLng = [plan.stops[yoldaIndex].incident.latitude!, plan.stops[yoldaIndex].incident.longitude!];
        fetchRoadRoute([prevPoint, target]).then((route) => {
          if (!cancelled) setLegRoutes((prev) => (prev[plan.teamId] === route ? prev : { ...prev, [plan.teamId]: route }));
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [plans]);

  const activeStationCodes = useMemo(
    () =>
      new Set(
        incidentsWithCoords.filter((i) => !["COZULDU", "KAPANDI"].includes(i.status)).map((i) => i.stationCode)
      ),
    [incidentsWithCoords]
  );

  // Istasyon kodu -> planlanan durak bilgisi (popup'ta "ne zaman gidilecek" icin)
  const stopByStation = useMemo(() => {
    const map = new Map<string, { plan: TeamRoutePlan; stop: TeamRoutePlan["stops"][number] }>();
    for (const plan of plans) for (const stop of plan.stops) map.set(stop.incident.stationCode, { plan, stop });
    return map;
  }, [plans]);

  const defaultCenter: LatLng =
    center ??
    (incidentsWithCoords[0]
      ? [incidentsWithCoords[0].latitude!, incidentsWithCoords[0].longitude!]
      : stations[0]
        ? [stations[0].latitude, stations[0].longitude]
        : [41.0082, 28.9784]);

  const fitAll = () => {
    const map = mapRef.current;
    if (!map) return;
    const points: LatLng[] = [
      ...incidentsWithCoords.map((i) => [i.latitude!, i.longitude!] as LatLng),
      ...(showStations ? stations.map((s) => [s.latitude, s.longitude] as LatLng) : []),
      ...(showTeams ? teams.filter((t) => t.lat != null).map((t) => [t.lat!, t.lng!] as LatLng) : []),
    ];
    if (points.length > 0) map.fitBounds(L.latLngBounds(points).pad(0.15));
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
    setTimeout(() => mapRef.current?.invalidateSize(), 60);
  };

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && toggleFullscreen();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  /** Plan basina canli arac konumu. */
  const vehicleForPlan = (plan: TeamRoutePlan): { position: LatLng; moving: boolean; label: string } => {
    const onSite = plan.stops.find(
      (s) => s.incident.status === "MUDAHALE_EDILIYOR" || s.incident.status === "PARCA_BEKLENIYOR"
    );
    if (onSite) {
      return {
        position: [onSite.incident.latitude!, onSite.incident.longitude!],
        moving: false,
        label: `sahada (${onSite.order}. durak)`,
      };
    }
    const yolda = plan.stops.find((s) => s.incident.status === "YOLDA");
    if (yolda) {
      const departed = yolda.incident.departedAt ? new Date(yolda.incident.departedAt).getTime() : now;
      const travelMs = Math.max(1, yolda.travelMinutes || 20) * 60_000;
      const progress = Math.min(0.97, Math.max(0.02, (now - departed) / travelMs));
      const leg =
        legRoutes[plan.teamId] ?? ([plan.origin, [yolda.incident.latitude!, yolda.incident.longitude!]] as LatLng[]);
      return {
        position: pointAlongRoute(leg, progress),
        moving: true,
        label: `${yolda.order}. duraga yolda · %${Math.round(progress * 100)}`,
      };
    }
    return { position: plan.origin, moving: false, label: "çıkışa hazırlanıyor" };
  };

  return (
    <div
      className={
        isFullscreen
          ? "fixed inset-0 z-[1200] bg-white"
          : "relative overflow-hidden rounded-2xl border border-navy-100/70"
      }
      style={isFullscreen ? undefined : { height }}
    >
      <MapContainer
        ref={mapRef}
        center={defaultCenter}
        zoom={zoom}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
        zoomControl
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />

        {/* Baz istasyonlari */}
        {showStations &&
          stations.map((station) => {
            const planned = stopByStation.get(station.code);
            return (
              <Marker
                key={station.id}
                position={[station.latitude, station.longitude]}
                icon={stationIcon(activeStationCodes.has(station.code))}
                zIndexOffset={0}
              >
                <Popup>
                  <div className="min-w-[180px] font-sans">
                    <p className="font-mono text-xs font-semibold text-navy-900">{station.code}</p>
                    <p className="mt-0.5 text-xs font-medium text-navy-700">{station.name}</p>
                    <p className="text-[11px] text-navy-400">
                      {station.district} · {station.region} Yakası · {station.technology}
                    </p>
                    <p className="mt-1 text-[11px] text-navy-500">
                      ~{(station.coverageUsers / 1000).toFixed(0)}K abone kapsama
                    </p>
                    {planned && (
                      <p className="mt-1.5 rounded-lg bg-navy-50 px-2 py-1 text-[11px] text-navy-700">
                        <span className="font-semibold">{planned.plan.teamName ?? "Ekip"}</span> — {planned.stop.order}. durak
                        · varış ~{format(planned.stop.etaArrival, "HH:mm")} · ~{planned.stop.workMinutes} dk çalışma
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}

        {/* Saha ekipleri (us konumlari) */}
        {showTeams &&
          teams
            .filter((t) => t.lat != null && t.lng != null)
            .map((team) => (
              <Marker
                key={team.team_id}
                position={[team.lat!, team.lng!]}
                icon={teamIcon(team.available, (team.name ?? "Ekip").split(" ")[0])}
                zIndexOffset={200}
              >
                <Popup>
                  <div className="min-w-[180px] font-sans">
                    <p className="text-xs font-semibold text-navy-900">{team.name ?? "Saha Ekibi"}</p>
                    <p className="mt-0.5 text-[11px] text-navy-500">Uzmanlık: {team.expertise.join(", ") || "—"}</p>
                    <p className="text-[11px] text-navy-500">Bölge: {team.region.join(", ") || "—"}</p>
                    <p className="mt-1 text-[11px] font-medium">
                      İş yükü: {team.active_incidents}/{team.max_capacity}{" "}
                      <span className={team.available ? "text-emerald-600" : "text-priority-kritik"}>
                        {team.available ? "· Müsait" : "· Kapasite dolu"}
                      </span>
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

        {/* Ekip rota planlari (cok durakli) */}
        {plans.map((plan) => {
          const route = routes[plan.teamId];
          if (!route) return null;
          const color = PRIORITY_COLORS[plan.stops[0]?.incident.priority ?? "ORTA"];
          const anyMoving = plan.stops.some((s) => s.incident.status === "YOLDA");
          return (
            <Polyline
              key={`route-${plan.teamId}`}
              positions={route}
              pathOptions={{
                color,
                weight: 3.5,
                opacity: anyMoving ? 0.85 : 0.55,
                dashArray: anyMoving ? undefined : "6 8",
                className: anyMoving ? "nops-route-active" : undefined,
              }}
            />
          );
        })}

        {/* Durak sira rozetleri (bir ekipte birden fazla vaka varsa) */}
        {plans
          .filter((plan) => plan.stops.length > 1)
          .flatMap((plan) =>
            plan.stops.map((stop) => (
              <Marker
                key={`stop-${plan.teamId}-${stop.incident.id}`}
                position={[stop.incident.latitude!, stop.incident.longitude!]}
                icon={stopOrderIcon(stop.order, PRIORITY_COLORS[stop.incident.priority])}
                zIndexOffset={500}
              >
                <Tooltip direction="top" offset={[12, -18]}>
                  <span className="font-sans text-[11px]">
                    {stop.order}. durak · varış ~{format(stop.etaArrival, "HH:mm")} · ~{stop.workMinutes} dk çalışma
                  </span>
                </Tooltip>
              </Marker>
            ))
          )}

        {/* Canli arac konumlari (ekip basina tek arac) */}
        {plans.map((plan) => {
          const { position, moving, label } = vehicleForPlan(plan);
          return (
            <Marker key={`vehicle-${plan.teamId}`} position={position} icon={vehicleIcon(moving)} zIndexOffset={600}>
              <Tooltip direction="top" offset={[0, -14]}>
                <span className="font-sans text-[11px] font-medium">
                  {plan.teamName ?? "Saha ekibi"} · {label}
                </span>
              </Tooltip>
            </Marker>
          );
        })}

        {/* Vakalar */}
        {incidentsWithCoords.map((incident) => (
          <Marker
            key={incident.id}
            position={[incident.latitude!, incident.longitude!]}
            icon={incidentIcon(incident.priority)}
            zIndexOffset={400}
          >
            <Popup>
              <div className="min-w-[190px] font-sans">
                <p className="font-mono text-xs font-semibold text-navy-900">{incident.incidentNo}</p>
                <p className="mt-0.5 text-xs text-navy-500">{incident.stationCode}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <FaultTypeBadge faultType={incident.faultType} />
                  <PriorityBadge priority={incident.priority} />
                  <StatusBadge status={incident.status} />
                </div>
                {incident.assignedTeamName && (
                  <p className="mt-2 text-[11px] text-navy-500">
                    Ekip: <span className="font-medium text-navy-800">{incident.assignedTeamName}</span>
                    {incident.etaTotalMinutes != null && ` · tahmini çözüm ~${Math.round(incident.etaTotalMinutes)} dk`}
                  </p>
                )}
                {onSelectIncident && (
                  <button
                    onClick={() => onSelectIncident(incident)}
                    className="mt-2 w-full rounded-lg bg-navy-900 px-2 py-1.5 text-[11px] font-medium text-white hover:bg-navy-700"
                  >
                    Vaka detayına git
                  </button>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Kontroller */}
      <div className="absolute right-3 top-3 z-[1000] flex gap-1.5">
        <MapControlButton onClick={fitAll} title="Tümünü sığdır">
          <Locate className="h-3.5 w-3.5" />
        </MapControlButton>
        <MapControlButton onClick={toggleFullscreen} title={isFullscreen ? "Küçült (Esc)" : "Tam ekran"}>
          {isFullscreen ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
        </MapControlButton>
      </div>

      {/* Katman secimi */}
      {(stations.length > 0 || teams.length > 0) && (
        <div className="absolute left-3 top-3 z-[1000] flex gap-1.5">
          {stations.length > 0 && (
            <LayerChip active={showStations} onClick={() => setShowStations((v) => !v)} label="İstasyonlar" />
          )}
          {teams.length > 0 && <LayerChip active={showTeams} onClick={() => setShowTeams((v) => !v)} label="Ekipler" />}
        </div>
      )}

      {/* Lejant */}
      <div className="absolute bottom-3 left-3 z-[1000] rounded-xl border border-navy-100/70 bg-white/95 px-3 py-2 shadow-soft backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium text-navy-600">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_COLORS.KRITIK }} /> Kritik
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_COLORS.YUKSEK }} /> Yüksek
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: PRIORITY_COLORS.ORTA }} /> Orta
          </span>
          {stations.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-navy-400" /> İstasyon
            </span>
          )}
          {teams.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-navy-800" /> Ekip
            </span>
          )}
          {plans.length > 0 && <span className="text-navy-400">— rota planı · ① durak sırası · 🚐 canlı konum</span>}
        </div>
      </div>
    </div>
  );
}

function MapControlButton({
  onClick,
  title,
  children,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-navy-100 bg-white/95 text-navy-700 shadow-soft backdrop-blur transition-colors hover:bg-navy-50"
    >
      {children}
    </button>
  );
}

function LayerChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium shadow-soft backdrop-blur transition-colors ${
        active
          ? "border-navy-800 bg-navy-900/95 text-white"
          : "border-navy-100 bg-white/95 text-navy-500 hover:bg-navy-50"
      }`}
    >
      {label}
    </button>
  );
}
