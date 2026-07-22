import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Incident, Priority } from "../../types";
import { PriorityBadge, StatusBadge } from "../ui/Badge";

const PRIORITY_COLORS: Record<Priority, string> = {
  KRITIK: "#E4002B",
  YUKSEK: "#FF6900",
  ORTA: "#F5A623",
  DUSUK: "#5B7A6B",
};

function markerIcon(priority: Priority): L.DivIcon {
  const color = PRIORITY_COLORS[priority];
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 18px; height: 18px; border-radius: 9999px;
      background: ${color}; border: 3px solid white;
      box-shadow: 0 2px 6px rgba(15,26,77,0.35);
    "></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

interface IncidentMapProps {
  incidents: Incident[];
  height?: number | string;
  center?: [number, number];
  zoom?: number;
  onSelect?: (incident: Incident) => void;
}

export function IncidentMap({ incidents, height = 360, center, zoom = 11 }: IncidentMapProps) {
  const withCoords = incidents.filter((i) => i.latitude != null && i.longitude != null);
  const defaultCenter: [number, number] = center ?? (withCoords[0] ? [withCoords[0].latitude!, withCoords[0].longitude!] : [41.0082, 28.9784]);

  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl border border-navy-100/70">
      <MapContainer center={defaultCenter} zoom={zoom} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        {withCoords.map((incident) => (
          <Marker key={incident.id} position={[incident.latitude!, incident.longitude!]} icon={markerIcon(incident.priority)}>
            <Popup>
              <div className="min-w-[160px] font-sans">
                <p className="font-mono text-xs font-semibold text-navy-900">{incident.incidentNo}</p>
                <p className="mt-0.5 text-xs text-navy-500">{incident.stationCode}</p>
                <div className="mt-2 flex gap-1.5">
                  <PriorityBadge priority={incident.priority} />
                  <StatusBadge status={incident.status} />
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
