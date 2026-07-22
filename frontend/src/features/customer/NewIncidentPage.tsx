import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, MapPin, Radio, Send, Sparkles, Thermometer, TrendingUp, Wifi, Zap } from "lucide-react";
import { toast } from "sonner";
import type { ComplaintAnalysis, EscalationRisk } from "../../types";
import { FaultTypeBadge } from "../../components/ui/Badge";
import { api, extractErrorMessage } from "../../lib/api";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { useStations } from "../shared/incidentHooks";

interface TelemetryForm {
  stationCode: string;
  latitude: string;
  longitude: string;
  signalStrength: string;
  packetLoss: string;
  temperature: string;
  powerStatus: "NORMAL" | "UNSTABLE" | "OUTAGE";
}

const DEFAULTS: TelemetryForm = {
  stationCode: "",
  latitude: "41.0082",
  longitude: "28.9784",
  signalStrength: "-70",
  packetLoss: "1",
  temperature: "35",
  powerStatus: "NORMAL",
};

const PRESETS: { label: string; icon: typeof Zap; values: Partial<TelemetryForm> }[] = [
  { label: "Normal", icon: Radio, values: { signalStrength: "-70", packetLoss: "1", temperature: "35", powerStatus: "NORMAL" } },
  { label: "Aşırı Isınma", icon: Thermometer, values: { signalStrength: "-80", packetLoss: "4", temperature: "88", powerStatus: "NORMAL" } },
  { label: "Güç Kesintisi", icon: Zap, values: { signalStrength: "-102", packetLoss: "40", temperature: "37", powerStatus: "OUTAGE" } },
  { label: "Bağlantı Sorunu", icon: Wifi, values: { signalStrength: "-104", packetLoss: "45", temperature: "36", powerStatus: "NORMAL" } },
];

export function NewIncidentPage() {
  const { data: stations } = useStations();
  const [form, setForm] = useState<TelemetryForm>(DEFAULTS);
  const [description, setDescription] = useState("");
  const [analysis, setAnalysis] = useState<ComplaintAnalysis | null>(null);
  const [result, setResult] = useState<null | {
    aiAvailable: boolean;
    message?: string;
    incident?: unknown;
    prediction?: { probability: number; recommendation: string; escalation_risk?: EscalationRisk | null };
  }>(null);
  const queryClient = useQueryClient();

  // Gemini LLM on analizi: musteri sikayet metnini yazinca "AI On Analiz" ile
  // muhtemel ariza alani + olasi neden + oneri aninda gosterilir (bkz. AI Service
  // /api/v1/ai/analyze-complaint). Analiz bildirimle birlikte vakaya da kaydedilir.
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/api/v1/ai/analyze-complaint", {
        text: description,
        station_code: form.stationCode || undefined,
        telemetry_summary: `sinyal ${form.signalStrength} dBm, paket kaybı %${form.packetLoss}, sıcaklık ${form.temperature}°C, güç ${form.powerStatus}`,
      });
      return response.data.data as ComplaintAnalysis;
    },
    onSuccess: (data) => setAnalysis(data),
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const response = await api.post("/api/v1/telemetry", {
        stationCode: form.stationCode,
        latitude: parseFloat(form.latitude),
        longitude: parseFloat(form.longitude),
        signalStrength: parseFloat(form.signalStrength),
        packetLoss: parseFloat(form.packetLoss),
        temperature: parseFloat(form.temperature),
        powerStatus: form.powerStatus,
        ...(description.trim().length >= 10 ? { description: description.trim() } : {}),
        ...(analysis ? { complaintAnalysis: analysis } : {}),
      });
      return response.data.data;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["my-incidents"] });
      toast.success("Telemetri gönderildi ve işlendi.");
    },
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  const applyPreset = (values: Partial<TelemetryForm>) => setForm((prev) => ({ ...prev, ...values }));

  return (
    <div>
      <PageHeader title="Arıza Bildir" description="Baz istasyonu telemetri verisini girin; yapay zekâ anında değerlendirecek." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardBody className="pt-5">
            <p className="mb-3 text-xs font-medium text-navy-400">Hızlı Senaryo Seç</p>
            <div className="mb-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => applyPreset(preset.values)}
                  className="flex flex-col items-center gap-1.5 rounded-xl border border-navy-100 bg-white px-3 py-3 text-xs font-medium text-navy-600 transition-colors hover:border-navy-300 hover:bg-navy-50"
                >
                  <preset.icon className="h-4 w-4 text-navy-500" />
                  {preset.label}
                </button>
              ))}
            </div>

            <form
              className="grid grid-cols-2 gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              <div className="col-span-2">
                <Select
                  label="Baz İstasyonu"
                  required
                  value={form.stationCode}
                  onChange={(e) => {
                    const station = stations?.find((s) => s.code === e.target.value);
                    setForm({
                      ...form,
                      stationCode: e.target.value,
                      ...(station ? { latitude: String(station.latitude), longitude: String(station.longitude) } : {}),
                    });
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
                {form.stationCode && stations && (
                  <p className="mt-1.5 text-[11px] text-navy-400">
                    {(() => {
                      const s = stations.find((x) => x.code === form.stationCode);
                      return s ? `${s.region} Yakası · ~${(s.coverageUsers / 1000).toFixed(0)}K abone kapsama · konum otomatik dolduruldu` : null;
                    })()}
                  </p>
                )}
              </div>
              <Input label="Enlem" required value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              <Input label="Boylam" required value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              <Input
                label="Sinyal Gücü (dBm)"
                required
                type="number"
                value={form.signalStrength}
                onChange={(e) => setForm({ ...form, signalStrength: e.target.value })}
              />
              <Input
                label="Paket Kaybı (%)"
                required
                type="number"
                value={form.packetLoss}
                onChange={(e) => setForm({ ...form, packetLoss: e.target.value })}
              />
              <Input
                label="Sıcaklık (°C)"
                required
                type="number"
                value={form.temperature}
                onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              />
              <Select
                label="Güç Durumu"
                value={form.powerStatus}
                onChange={(e) => setForm({ ...form, powerStatus: e.target.value as TelemetryForm["powerStatus"] })}
              >
                <option value="NORMAL">Normal</option>
                <option value="UNSTABLE">Dengesiz</option>
                <option value="OUTAGE">Kesinti</option>
              </Select>

              <div className="col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-navy-600">
                  Sorun Açıklaması <span className="font-normal text-navy-400">(opsiyonel — AI ön analiz için)</span>
                </label>
                <textarea
                  className="min-h-[88px] w-full rounded-xl border border-navy-100 bg-white p-3 text-sm text-navy-900 placeholder:text-navy-300 focus:outline-none focus:ring-4 focus:ring-navy-100"
                  placeholder="Örn: Evde internet sürekli kopuyor, akşam saatlerinde televizyon donuyor, telefonla arama yapamıyorum..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={2000}
                />
                <div className="mt-2 flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={description.trim().length < 10}
                    loading={analyzeMutation.isPending}
                    onClick={() => analyzeMutation.mutate()}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> AI Ön Analiz
                  </Button>
                  <span className="text-[11px] text-navy-300">{description.length}/2000</span>
                </div>

                {analysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 rounded-xl border border-brand-yellow/50 bg-brand-yellow/10 p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-navy-900">
                        <Sparkles className="h-3.5 w-3.5 text-navy-700" /> AI Sorun Tahmini
                      </p>
                      <FaultTypeBadge faultType={analysis.muhtemel_alan} />
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-navy-700">{analysis.olasi_neden}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-navy-600">
                      <span className="font-semibold">Öneri:</span> {analysis.oneri}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white">
                        <div className="h-full rounded-full bg-navy-700" style={{ width: `${Math.round(analysis.guven * 100)}%` }} />
                      </div>
                      <span className="text-[10px] font-medium text-navy-500">güven %{Math.round(analysis.guven * 100)}</span>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="col-span-2 mt-2">
                <Button type="submit" size="lg" loading={mutation.isPending} className="w-full">
                  <Send className="h-4 w-4" /> Telemetriyi Gönder
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="lg:col-span-2">
          <ResultPanel result={result} />
        </div>
      </div>
    </div>
  );
}

const RISK_STYLES: Record<string, string> = {
  DUSUK: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ORTA: "bg-amber-50 text-amber-700 border-amber-200",
  YUKSEK: "bg-red-50 text-red-700 border-red-200",
};

function ResultPanel({
  result,
}: {
  result: null | {
    aiAvailable: boolean;
    message?: string;
    prediction?: { probability: number; recommendation: string; escalation_risk?: EscalationRisk | null };
  };
}) {
  if (!result) {
    return (
      <Card className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <MapPin className="mx-auto h-8 w-8 text-navy-200" />
          <p className="mt-3 text-sm text-navy-400">Sonuç burada görünecek</p>
        </div>
      </Card>
    );
  }

  const probability = result.prediction?.probability ?? null;

  return (
    <motion.div initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
      <Card className={result.aiAvailable ? "border-emerald-200" : "border-amber-200"}>
        <CardBody className="pt-5">
          <div className="mb-3 flex items-center gap-2">
            {result.aiAvailable ? (
              <Radio className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            )}
            <p className="text-sm font-semibold text-navy-900">
              {result.aiAvailable ? "AI Tahmini Tamamlandı" : "AI Servisi Erişilemedi"}
            </p>
          </div>
          <p className="text-sm text-navy-500">{result.message ?? "Vaka oluşturuldu ve saha ekibine yönlendirildi."}</p>

          {probability !== null && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs text-navy-400">
                <span>Arıza Olasılığı</span>
                <span className="font-semibold text-navy-900">{Math.round(probability * 100)}%</span>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-navy-50">
                <motion.div
                  className="h-full rounded-full bg-priority-kritik"
                  initial={{ width: 0 }}
                  animate={{ width: `${probability * 100}%` }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </div>
            </div>
          )}

          {result.prediction?.escalation_risk && (
            <div className={`mt-4 rounded-xl border px-3 py-2.5 ${RISK_STYLES[result.prediction.escalation_risk.risk] ?? RISK_STYLES.ORTA}`}>
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <TrendingUp className="h-3.5 w-3.5" /> Eskalasyon Riski: {result.prediction.escalation_risk.risk}
              </p>
              <p className="mt-0.5 text-[11px] opacity-80">
                İstasyonun arıza geçmişi profiline göre — gerçek şebeke verisiyle (Telstra) eğitilmiş model.
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </motion.div>
  );
}
