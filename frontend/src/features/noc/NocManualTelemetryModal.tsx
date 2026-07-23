import { useState } from "react";
import { PlusCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { api, extractErrorMessage } from "../../lib/api";
import { useStations } from "../shared/incidentHooks";

interface NocManualTelemetryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function NocManualTelemetryModal({ isOpen, onClose, onSuccess }: NocManualTelemetryModalProps) {
  const { data: stations } = useStations();
  const [stationCode, setStationCode] = useState("");
  const [latitude, setLatitude] = useState("41.0082");
  const [longitude, setLongitude] = useState("28.9784");
  const [temperature, setTemperature] = useState<number>(85.0);
  const [signalStrength, setSignalStrength] = useState<number>(-95);
  const [packetLoss, setPacketLoss] = useState<number>(35.0);
  const [powerStatus, setPowerStatus] = useState("OUTAGE");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stationCode) {
      toast.error("Lütfen bir baz istasyonu seçin.");
      return;
    }
    setIsSubmitting(true);
    try {
      let complaintAnalysis = undefined;
      if (description.trim().length > 5) {
        try {
          const res = await api.post("/api/v1/ai/analyze-complaint", { text: description });
          if (res.data?.data) {
            complaintAnalysis = res.data.data;
          }
        } catch {
          // AI analysis optional
        }
      }

      await api.post("/api/v1/telemetry", {
        stationCode,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        temperature,
        signalStrength,
        packetLoss,
        powerStatus,
        description: description.trim() || undefined,
        complaintAnalysis,
      });

      toast.success("Telemetri / arıza kaydı başarıyla oluşturuldu.");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50 backdrop-blur-sm p-4 animate-fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-navy-100 space-y-4">
        <div className="flex items-center justify-between border-b border-navy-100 pb-3">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-navy-900" />
            <h3 className="font-semibold text-navy-900">NOC Manuel Telemetri / Arıza Girişi</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-navy-400 hover:bg-navy-50 hover:text-navy-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Select
                label="Baz İstasyonu"
                required
                value={stationCode}
                onChange={(e) => {
                  const station = stations?.find((s) => s.code === e.target.value);
                  setStationCode(e.target.value);
                  if (station) {
                    setLatitude(String(station.latitude));
                    setLongitude(String(station.longitude));
                  }
                }}
              >
                <option value="" disabled>
                  İstasyon seçin...
                </option>
                {stations?.map((station) => (
                  <option key={station.id} value={station.code}>
                    {station.code} — {station.name} ({station.district}, {station.technology})
                  </option>
                ))}
              </Select>
              {stationCode && stations && (
                <p className="mt-1.5 text-[11px] text-navy-400">
                  {(() => {
                    const s = stations.find((x) => x.code === stationCode);
                    return s ? `Konum otomatik dolduruldu (${s.latitude}, ${s.longitude})` : null;
                  })()}
                </p>
              )}
            </div>
            <Input
              label="Enlem"
              type="number"
              step="0.0001"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              required
            />
            <Input
              label="Boylam"
              type="number"
              step="0.0001"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              required
            />
            <Select label="Güç Durumu" value={powerStatus} onChange={(e) => setPowerStatus(e.target.value)}>
              <option value="NORMAL">NORMAL</option>
              <option value="OUTAGE">OUTAGE (Kesinti)</option>
              <option value="UNSTABLE">UNSTABLE (Kararsız)</option>
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Sıcaklık (°C)"
              type="number"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              required
            />
            <Input
              label="Sinyal (dBm)"
              type="number"
              value={signalStrength}
              onChange={(e) => setSignalStrength(parseInt(e.target.value, 10))}
              required
            />
            <Input
              label="Paket Kaybı (%)"
              type="number"
              step="0.1"
              value={packetLoss}
              onChange={(e) => setPacketLoss(parseFloat(e.target.value))}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-navy-700">Müşteri / Saha Bildirimi (Opsiyonel)</label>
            <textarea
              className="w-full min-h-[80px] rounded-xl border border-navy-100 bg-white p-3 text-xs focus:outline-none focus:ring-4 focus:ring-navy-100"
              placeholder="İstasyon ve çevre bildirimi, müşteri şikayeti..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-navy-100">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              İptal
            </Button>
            <Button type="submit" loading={isSubmitting}>
              Vaka / Telemetri Gönder
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
