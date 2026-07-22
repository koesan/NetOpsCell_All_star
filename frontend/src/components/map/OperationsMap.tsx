import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Expand, Locate, Shrink } from "lucide-react";
import type { Incident, IncidentStatus, Priority, Station, TeamInfo } from "../../types";
import { FaultTypeBadge, PriorityBadge, StatusBadge } from "../ui/Badge";

/**
 * NetOpsCell Operasyon Haritasi.
 *
 * Katmanlar: baz istasyonlari, saha ekipleri (us konumu + anlik is yuku), aktif vakalar
 * (oncelik renkli, nabiz animasyonlu) ve atama rota planlari. YOLDA durumundaki her vaka
 * icin arac ikonu, `departedAt` + ETA yol suresine gore rota uzerinde CANLI olarak ilerler —
 * tum istemciler ayni deterministik konumu gorur, ek altyapi gerekmez.
 *
 * Rota: OSRM public API'den gercek yol geometrisi cekilir (bellek ici cache); erisilemezse
 * kus ucusu kavisli (bezier) cizgiye zarif dusus yapilir.
 */

const PRIORITY_COLORS: Record<Priority, string> = {
  KRITIK: "#E4002B",
  YUKSEK: "#FF6900",
  ORTA: "#F5A623",
  DUSUK: "#5B7A6B",
};

const EN_ROUTE_STATUSES: IncidentStatus[] = ["ATANDI", "YOLDA", "MUDAHALE_EDILIYOR", "PARCA_BEKLENIYOR"];

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

/** OSRM erisilemezse: hafif kavisli kus ucusu rota (quadratic bezier, 32 nokta). */
function fallbackArc(from: LatLng, to: LatLng): LatLng[] {
  const mid: LatLng = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const dx = to[1] - from[1];
  const dy = to[0] - from[0];
  const curve = 0.15;
  const control: LatLng = [mid[0] + dx * curve, mid[1] - dy * curve];
  const points: LatLng[] = [];
  for (let i = 0; i <= 32; i++) {
    const t = i / 32;
    const lat = (1 - t) ** 2 * from[0] + 2 * (1 - t) * t * control[0] + t ** 2 * to[0];
    const lng = (1 - t) ** 2 * from[1] + 2 * (1 - t) * t * control[1] + t ** 2 * to[1];
    points.push([lat, lng]);
  }
  return points;
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
      const a = route[i];
      const b = route[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    target -= segments[i];
  }
  return route[route.length - 1];
}

// OSRM rota cache'i (modul seviyesi — sayfalar arasi gecislerde yeniden fetch onlenir)
const routeCache = new Map<string, LatLng[]>();

async function fetchRoadRoute(from: LatLng, to: LatLng): Promise<LatLng[]> {
  const key = `${from[0].toFixed(4)},${from[1].toFixed(4)}-${to[0].toFixed(4)},${to[1].toFixed(4)}`;
  const cached = routeCache.get(key);
  if (cached) return cached;
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
    const response = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error(`OSRM ${response.status}`);
    const json = await response.json();
    const coords: [number, number][] = json?.routes?.[0]?.geometry?.coordinates ?? [];
    if (coords.length < 2) throw new Error("OSRM bos rota");
    const route = coords.map(([lng, lat]) => [lat, lng] as LatLng);
    routeCache.set(key, route);
    return route;
  } catch {
    const arc = fallbackArc(from, to);
    routeCache.set(key, arc);
    return arc;
  }
}

// ---------------------------------------------------------------------------
// Marker ikonlari (divIcon + inline SVG — harici asset bagimliligi yok)
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
  /** Rota + canli arac katmani (atanmis vakalar icin). */
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
  // Canli akis saati: arac konumlari her 1.5 sn'de yeniden hesaplanir
  const [now, setNow] = useState(() => Date.now());

  const incidentsWithCoords = useMemo(
    () => incidents.filter((i) => i.latitude != null && i.longitude != null),
    [incidents]
  );

  const routedIncidents = useMemo(
    () =>
      showRoutes
        ? incidentsWithCoords.filter(
            (i) =>
              EN_ROUTE_STATUSES.includes(i.status) && i.assignedTeamLat != null && i.assignedTeamLng != null
          )
        : [],
    [incidentsWithCoords, showRoutes]
  );

  const hasMovingVehicle = routedIncidents.some((i) => i.status === "YOLDA");

  useEffect(() => {
    if (!hasMovingVehicle) return;
    const timer = setInterval(() => setNow(Date.now()), 1500);
    return () => clearInterval(timer);
  }, [hasMovingVehicle]);

  // Gercek yol rotalarini asenkron cek (cache'li); bilesen kaldirilmissa state'e yazma
  useEffect(() => {
    let cancelled = false;
    routedIncidents.forEach((incident) => {
      const from: LatLng = [incident.assignedTeamLat!, incident.assignedTeamLng!];
      const to: LatLng = [incident.latitude!, incident.longitude!];
      fetchRoadRoute(from, to).then((route) => {
        if (!cancelled) setRoutes((prev) => (prev[incident.id] === route ? prev : { ...prev, [incident.id]: route }));
      });
    });
    return () => {
      cancelled = true;
    };
  }, [routedIncidents]);

  const activeStationCodes = useMemo(
    () =>
      new Set(
        incidentsWithCoords.filter((i) => !["COZULDU", "KAPANDI"].includes(i.status)).map((i) => i.stationCode)
      ),
    [incidentsWithCoords]
  );

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
    // Konteyner boyutu degistikten sonra Leaflet'in tile hesabini tazele
    setTimeout(() => mapRef.current?.invalidateSize(), 60);
  };

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && toggleFullscreen();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullscreen]);

  /** YOLDA vakasi icin canli arac konumu; diger durumlar icin sabit konum. */
  const vehiclePosition = (incident: Incident): { position: LatLng; moving: boolean; progress: number } => {
    const route = routes[incident.id] ?? [
      [incident.assignedTeamLat!, incident.assignedTeamLng!],
      [incident.latitude!, incident.longitude!],
    ];
    if (incident.status === "ATANDI") return { position: route[0], moving: false, progress: 0 };
    if (incident.status !== "YOLDA") return { position: route[route.length - 1], moving: false, progress: 1 };

    const departed = incident.departedAt ? new Date(incident.departedAt).getTime() : now;
    const travelMs = Math.max(1, incident.etaTravelMinutes ?? 20) * 60_000;
    const progress = Math.min(0.97, Math.max(0.02, (now - departed) / travelMs));
    return { position: pointAlongRoute(route, progress), moving: true, progress };
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
          stations.map((station) => (
            <Marker
              key={station.id}
              position={[station.latitude, station.longitude]}
              icon={stationIcon(activeStationCodes.has(station.code))}
              zIndexOffset={0}
            >
              <Popup>
                <div className="min-w-[170px] font-sans">
                  <p className="font-mono text-xs font-semibold text-navy-900">{station.code}</p>
                  <p className="mt-0.5 text-xs font-medium text-navy-700">{station.name}</p>
                  <p className="text-[11px] text-navy-400">
                    {station.district} · {station.region} Yakasi · {station.technology}
                  </p>
                  <p className="mt-1 text-[11px] text-navy-500">
                    ~{(station.coverageUsers / 1000).toFixed(0)}K abone kapsama
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}

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

        {/* Rota planlari */}
        {routedIncidents.map((incident) => {
          const route = routes[incident.id];
          if (!route) return null;
          const color = PRIORITY_COLORS[incident.priority];
          const done = incident.status !== "ATANDI" && incident.status !== "YOLDA";
          return (
            <Polyline
              key={`route-${incident.id}`}
              positions={route}
              pathOptions={{
                color,
                weight: 3.5,
                opacity: done ? 0.35 : 0.8,
                dashArray: incident.status === "ATANDI" ? "6 8" : undefined,
                className: incident.status === "YOLDA" ? "nops-route-active" : undefined,
              }}
            />
          );
        })}

        {/* Canli arac konumlari */}
        {routedIncidents.map((incident) => {
          const { position, moving, progress } = vehiclePosition(incident);
          return (
            <Marker key={`vehicle-${incident.id}`} position={position} icon={vehicleIcon(moving)} zIndexOffset={600}>
              <Tooltip direction="top" offset={[0, -14]}>
                <span className="font-sans text-[11px] font-medium">
                  {incident.assignedTeamName ?? "Saha ekibi"}
                  {moving
                    ? ` · yolda %${Math.round(progress * 100)}`
                    : incident.status === "ATANDI"
                      ? " · çıkışa hazırlanıyor"
                      : " · sahada"}
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
          {routedIncidents.length > 0 && <span className="text-navy-400">— rota · 🚐 canlı konum</span>}
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
