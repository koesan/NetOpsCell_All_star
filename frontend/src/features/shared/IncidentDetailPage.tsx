import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Cpu,
  Gauge,
  MapPin,
  Navigation,
  Route,
  Sparkles,
  Star,
  Timer,
  Truck,
  Users,
  Wrench,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Card, CardBody, CardHeader, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Select } from "../../components/ui/Input";
import { FaultTypeBadge, PriorityBadge, StatusBadge } from "../../components/ui/Badge";
import { ErrorState, LoadingState } from "../../components/ui/States";
import { OperationsMap } from "../../components/map/OperationsMap";
import { IncidentChat } from "../../components/chat/IncidentChat";
import { api, extractErrorMessage } from "../../lib/api";
import { SlaCountdown } from "./SlaCountdown";
import type { Incident, IncidentHistoryEntry, LocalAiAnalysis } from "../../types";
import { STATUS_LABELS } from "../../lib/statusLabels";
import {
  useConfirmAssign,
  useCreateResolution,
  useIncident,
  useIncidentHistory,
  useIncidentMessages,
  useIncidentResolution,
  useManualAssign,
  useMarkMessagesRead,
  useRateResolution,
  useSendMessage,
  useStations,
  useTeams,
  useUpdateStatus,
} from "./incidentHooks";

interface StatusAction {
  label: string;
  status: string;
  /** Case 4.2 state machine tablosundaki "Kim Yapabilir" hanesiyle birebir eslesir. */
  actor: "TEKNISYEN" | "NOC";
}

const NEXT_STATUS: Record<string, StatusAction[]> = {
  ATANDI: [{ label: "Sahaya Hareket Et", status: "YOLDA", actor: "TEKNISYEN" }],
  YOLDA: [{ label: "Sahaya Ulaştım", status: "MUDAHALE_EDILIYOR", actor: "TEKNISYEN" }],
  MUDAHALE_EDILIYOR: [{ label: "Parça Bekleniyor", status: "PARCA_BEKLENIYOR", actor: "TEKNISYEN" }],
  // Case 4.2: bu gecisin "Kim Yapabilir" hanesi Sistem'dir — NOC/dispatch parca tedarigini
  // dogrular, saha teknisyeni kendi kendine bu durumdan cikamaz (bkz. incident.parts.supplied event'i).
  PARCA_BEKLENIYOR: [{ label: "Parça Tedarik Edildi (Tedarik Onayı)", status: "MUDAHALE_EDILIYOR", actor: "NOC" }],
};


export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: incident, isLoading, isError, refetch } = useIncident(id);
  const { data: messages } = useIncidentMessages(id);
  const { data: history } = useIncidentHistory(id);
  const { data: stations } = useStations();
  const { data: resolution } = useIncidentResolution(id, incident?.status === "COZULDU" || incident?.status === "KAPANDI");

  const updateStatus = useUpdateStatus(id);
  const confirmAssign = useConfirmAssign(id);
  const manualAssign = useManualAssign(id);
  const createResolution = useCreateResolution(id);
  const rateResolution = useRateResolution(id);
  const sendMessage = useSendMessage(id);
  const markMessagesRead = useMarkMessagesRead(id);

  const [resolutionNote, setResolutionNote] = useState("");
  const [rating, setRating] = useState(5);
  const [isPermanent, setIsPermanent] = useState(true);
  const [selectedTeamId, setSelectedTeamId] = useState("");

  const role = user?.role;
  const { data: teams } = useTeams(incident?.status === "YENI" && role === "SUPERVIZOR");
  const canMessage = role === "SAHA_TEKNISYENI" || role === "NOC_OPERATORU" || role === "SUPERVIZOR";

  // Thread goruntulenirken okunmamis mesajlari READ isaretle (MongoDB read-receipt)
  useEffect(() => {
    if (canMessage && messages && messages.length > 0) {
      markMessagesRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canMessage, messages?.length]);

  if (isLoading) return <LoadingState label="Vaka detayı yükleniyor..." />;
  if (isError || !incident) return <ErrorState message="Vaka bulunamadı." onRetry={() => refetch()} />;

  const isAssignedTech = role === "SAHA_TEKNISYENI" && incident.assignedTeamId === user?.id;
  const isNocOrSupervisor = role === "NOC_OPERATORU" || role === "SUPERVIZOR";
  // Her aksiyon case 4.2'deki "Kim Yapabilir" hanesine gore filtrelenir: teknisyen
  // aksiyonlarini sadece atanan teknisyen (veya supervizor), NOC aksiyonlarini
  // (parca tedarik onayi gibi) sadece NOC/supervizor gorur.
  const availableActions = (NEXT_STATUS[incident.status] ?? []).filter(
    (a) => role === "SUPERVIZOR" || (a.actor === "TEKNISYEN" && isAssignedTech) || (a.actor === "NOC" && isNocOrSupervisor)
  );
  const canTransition = availableActions.length > 0;
  const canResolve = incident.status === "MUDAHALE_EDILIYOR" && (isAssignedTech || role === "SUPERVIZOR");
  const canClose = incident.status === "COZULDU" && (role === "NOC_OPERATORU" || role === "SUPERVIZOR");
  const canRate = incident.status === "KAPANDI" && !resolution?.ratedAt && (role === "NOC_OPERATORU" || role === "SUPERVIZOR");
  const canConfirm = incident.status === "YENI" && (role === "NOC_OPERATORU" || role === "SUPERVIZOR");

  const run = async (action: () => Promise<unknown>, successMessage: string) => {
    try {
      await action();
      toast.success(successMessage);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <div>
      <button
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-navy-400 hover:text-navy-700"
      >
        <ArrowLeft className="h-4 w-4" /> Geri
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-mono text-xl font-semibold text-navy-950">{incident.incidentNo}</h1>
            <StatusBadge status={incident.status} />
          </div>
          <p className="mt-1 text-sm text-navy-500">
            {incident.stationCode} · {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true, locale: tr })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FaultTypeBadge faultType={incident.faultType} />
          <PriorityBadge priority={incident.priority} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Telemetri &amp; AI Değerlendirmesi</CardTitle>
              <SlaCountdown incident={incident} />
            </CardHeader>
            <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <InfoStat icon={Gauge} label="AI Olasılığı" value={incident.aiProbability != null ? `${Math.round(incident.aiProbability * 100)}%` : "—"} />
              <InfoStat icon={Zap} label="Öncelik" value={<PriorityBadge priority={incident.priority} />} />
              <InfoStat icon={MapPin} label="Konum" value={incident.latitude ? `${incident.latitude.toFixed(3)}, ${incident.longitude!.toFixed(3)}` : "—"} />
              <InfoStat
                icon={Timer}
                label="Tahmini Çözüm"
                value={incident.etaTotalMinutes != null ? `~${Math.round(incident.etaTotalMinutes)} dk` : "—"}
              />
            </CardBody>
          </Card>

          {incident.latitude != null && incident.longitude != null && (
            <Card className="overflow-hidden p-0">
              <OperationsMap
                incidents={[incident]}
                stations={stations ?? []}
                center={[incident.latitude, incident.longitude]}
                zoom={12}
                height={320}
              />
            </Card>
          )}

          <FieldOperationCard incident={incident} />

          {resolution && (
            <Card>
              <CardHeader>
                <CardTitle>Çözüm Notu</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-sm text-navy-700">{resolution.resolutionNote}</p>
                {resolution.ratedAt && (
                  <div className="mt-3 flex items-center gap-2 text-xs text-navy-400">
                    <div className="flex">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className={`h-3.5 w-3.5 ${i < (resolution.rating ?? 0) ? "fill-brand-yellow text-brand-yellow" : "text-navy-200"}`} />
                      ))}
                    </div>
                    <span>{resolution.isPermanent ? "Kalıcı çözüm" : "Geçici çözüm"}</span>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {canMessage && user && (
            <Card className="overflow-hidden p-0">
              <CardHeader className="border-b border-navy-100/70">
                <CardTitle>Saha İletişimi</CardTitle>
                <span className="text-[11px] text-navy-400">Saha ekibi · NOC · Süpervizör</span>
              </CardHeader>
              <IncidentChat
                messages={messages ?? []}
                currentUserId={user.id}
                currentUserRole={user.role}
                onSend={(content) => sendMessage.mutateAsync(content)}
                height={430}
              />
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {canConfirm && (
            <Card>
              <CardHeader>
                <CardTitle>Atama Onayı</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="mb-3 text-xs text-navy-500">AI tahminini onaylayıp uygun saha ekibine otomatik atama yapın.</p>
                <Button className="w-full" loading={confirmAssign.isPending} onClick={() => run(() => confirmAssign.mutateAsync(), "Ekip ataması tetiklendi.")}>
                  Onayla ve Ata
                </Button>
              </CardBody>
            </Card>
          )}

          {/* Case 3.3/5.3/7: Supervizor her zaman manuel atama yapabilir — AI onerisini
              atlayip dogrudan bir ekip secebilir (orn. AI'in onerdigi ekibi degistirmek istediginde). */}
          {incident.status === "YENI" && role === "SUPERVIZOR" && (
            <Card>
              <CardHeader>
                <CardTitle>Manuel Atama</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                <Select label="Saha Ekibi" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)}>
                  <option value="" disabled>
                    Ekip seçin...
                  </option>
                  {teams?.map((team) => (
                    <option key={team.team_id} value={team.team_id}>
                      {team.name ?? team.team_id.slice(0, 8)} — {team.expertise.join("/") || "genel"} ·{" "}
                      {team.active_incidents}/{team.max_capacity} {team.available ? "" : "(dolu)"}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={!selectedTeamId}
                  loading={manualAssign.isPending}
                  onClick={() =>
                    run(
                      () => manualAssign.mutateAsync(selectedTeamId).then(() => setSelectedTeamId("")),
                      "Ekip manuel olarak atandı."
                    )
                  }
                >
                  Seçili Ekibe Ata
                </Button>
              </CardBody>
            </Card>
          )}

          <AssignmentCard incident={incident} />

          {canTransition && (
            <Card>
              <CardHeader>
                <CardTitle>Durum Güncelle</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-2">
                {availableActions.map((next) => (
                  <Button
                    key={next.status}
                    variant="secondary"
                    loading={updateStatus.isPending}
                    onClick={() => run(() => updateStatus.mutateAsync(next.status), "Durum güncellendi.")}
                  >
                    {next.label}
                  </Button>
                ))}
              </CardBody>
            </Card>
          )}

          {canResolve && (
            <Card>
              <CardHeader>
                <CardTitle>Çözüm Notu Gir</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                <textarea
                  className="min-h-[100px] rounded-xl border border-navy-100 bg-white p-3 text-sm focus:outline-none focus:ring-4 focus:ring-navy-100"
                  placeholder="Yapılan müdahaleyi açıklayın..."
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                />
                <Button
                  loading={createResolution.isPending}
                  disabled={resolutionNote.trim().length < 3}
                  onClick={() => run(() => createResolution.mutateAsync(resolutionNote), "Vaka çözüldü olarak işaretlendi.")}
                >
                  Çözüldü Olarak Kapat
                </Button>
              </CardBody>
            </Card>
          )}

          {canClose && (
            <Card>
              <CardHeader>
                <CardTitle>Doğrula ve Kapat</CardTitle>
              </CardHeader>
              <CardBody>
                <Button className="w-full" variant="secondary" loading={updateStatus.isPending} onClick={() => run(() => updateStatus.mutateAsync("KAPANDI"), "Vaka kapatıldı.")}>
                  Kapatmayı Onayla
                </Button>
              </CardBody>
            </Card>
          )}

          {canRate && (
            <Card>
              <CardHeader>
                <CardTitle>Çözümü Değerlendir</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <motion.button
                      key={i}
                      type="button"
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setRating(i + 1)}
                    >
                      <Star className={`h-6 w-6 ${i < rating ? "fill-brand-yellow text-brand-yellow" : "text-navy-200"}`} />
                    </motion.button>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-navy-600">
                  <input type="checkbox" checked={isPermanent} onChange={(e) => setIsPermanent(e.target.checked)} className="h-4 w-4 rounded border-navy-300" />
                  Kalıcı çözüm
                </label>
                <Button
                  loading={rateResolution.isPending}
                  onClick={() => run(() => rateResolution.mutateAsync({ rating, isPermanent }), "Değerlendirme kaydedildi.")}
                >
                  Değerlendirmeyi Gönder
                </Button>
              </CardBody>
            </Card>
          )}

          <TimelineCard incident={incident} history={history ?? []} />

          {/* NOC/teknisyen/supervizor bu analizi zaten mesaj thread'inde otomatik bir
              "AI_ANALYSIS" balonu olarak goruyor (bkz. IncidentChat.tsx) — burada tekrar
              gostermek hem gereksiz tekrar hem de "Musteri Bildirimi" basligiyla kafa
              karistirici. Musteri thread'i goremedigi icin kendi bildirimini/analizi
              gorebilecegi TEK yer burasidir. */}
          {role === "MUSTERI" && (incident.customerNote || incident.complaintAnalysis) && (
            <Card>
              <CardHeader>
                <CardTitle>Bildiriminiz &amp; AI Ön Analizi</CardTitle>
                <Sparkles className="h-4 w-4 text-navy-300" />
              </CardHeader>
              <CardBody className="space-y-3">
                {incident.customerNote && (
                  <blockquote className="rounded-xl border-l-4 border-navy-200 bg-surface-subtle px-3.5 py-2.5 text-sm italic text-navy-700">
                    “{incident.customerNote}”
                  </blockquote>
                )}
                {incident.complaintAnalysis && (
                  <div className="rounded-xl border border-brand-yellow/50 bg-brand-yellow/10 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-navy-900">Ön Analiz</p>
                      <FaultTypeBadge faultType={incident.complaintAnalysis.muhtemel_alan} />
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-navy-700">{incident.complaintAnalysis.olasi_neden}</p>
                    {/* Bu kart artik sadece musteriye gorunuyor (yukarida bkz.) — saha/NOC'a
                        yonelik teknik "oneri" yerine musteriye guven verici bir ozet gosterilir. */}
                    <p className="mt-1 text-xs leading-relaxed text-navy-600">
                      Ekibimiz bu ön analizi kullanarak sorununuzu en kısa sürede çözecek.
                    </p>
                  </div>
                )}
              </CardBody>
            </Card>
          )}

          {canMessage && (
            <Card>
              <CardHeader>
                <CardTitle>Gemini AI Ön Analizi</CardTitle>
                <Sparkles className="h-4 w-4 text-navy-300" />
              </CardHeader>
              <CardBody className="space-y-3">
                {incident.complaintAnalysis ? (
                  <div className="rounded-xl border border-brand-yellow/50 bg-brand-yellow/10 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-navy-900">Ön Analiz</p>
                      <FaultTypeBadge faultType={incident.complaintAnalysis.muhtemel_alan} />
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-navy-700">{incident.complaintAnalysis.olasi_neden}</p>
                    <p className="mt-1 text-xs leading-relaxed text-navy-600">
                      <span className="font-semibold">Öneri:</span> {incident.complaintAnalysis.oneri}
                    </p>
                    <span className="mt-1.5 inline-block text-[10px] font-medium text-navy-500">
                      güven %{Math.round(incident.complaintAnalysis.guven * 100)}
                    </span>
                  </div>
                ) : (
                  <p className="text-xs leading-relaxed text-navy-400">
                    Bu vaka için Gemini ön analizi mevcut değil. Anahtar tanımlı değilse veya sorgu başarısız
                    olduysa özellik devre dışı kalır; API anahtarı yapılandırıldığında yeni bildirimlerde
                    otomatik olarak görünür.
                  </p>
                )}
              </CardBody>
            </Card>
          )}

          {canMessage && <LocalAiPanel incident={incident} />}
        </div>
      </div>
    </div>
  );
}

/** Yerel/self-hosted AI ile ikinci gorus (Gemini'nin YERINE GECMEZ, opsiyonel bir
 * profile ile calisan servistir - kapaliysa 503 doner ve butonun altinda gosterilir).
 * Sadece cozen ekip rolleri gorur (musteriye gosterilmez). */
function LocalAiPanel({ incident }: { incident: Incident }) {
  const [result, setResult] = useState<LocalAiAnalysis | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const text = [
        `İstasyon: ${incident.stationCode}`,
        `Sistemin sınıflandırdığı arıza türü: ${incident.faultType}`,
        incident.customerNote ? `Müşteri bildirimi: ${incident.customerNote}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      const response = await api.post("/api/v1/local-ai/diagnose", { text });
      return response.data.data as LocalAiAnalysis;
    },
    onSuccess: (data) => setResult(data),
    onError: (err) => toast.error(extractErrorMessage(err)),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Yerel AI (Deneysel)</CardTitle>
        <Cpu className="h-4 w-4 text-navy-300" />
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="text-xs leading-relaxed text-navy-500">
          Gemini'den bağımsız, tamamen bu sunucuda çalışan açık kaynaklı bir modelle
          (Qwen2.5-1.5B-Instruct) ikinci bir görüş alın. Opsiyonel bir servistir;
          etkin değilse aşağıdaki istek başarısız olur.
        </p>
        <Button variant="secondary" size="sm" loading={mutation.isPending} onClick={() => mutation.mutate()}>
          Yerel AI ile Analiz Et
        </Button>
        {mutation.isPending && (
          <p className="text-[11px] text-navy-400">
            Model GPU olmadan çalışıyor, yanıt birkaç dakika sürebilir — lütfen bekleyin.
          </p>
        )}
        {result && (
          <div className="space-y-1.5 rounded-xl border border-navy-200 bg-surface-subtle p-3.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-navy-900">{result.ariza_turu ?? "Belirsiz"}</p>
              {result.oncelik && (
                <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-semibold text-navy-500">
                  {result.oncelik}
                </span>
              )}
            </div>
            {result.kok_neden && <p className="text-xs leading-relaxed text-navy-700">{result.kok_neden}</p>}
            {result.önerilen_aksiyonlar && result.önerilen_aksiyonlar.length > 0 && (
              <ul className="list-disc space-y-0.5 pl-4 text-xs leading-relaxed text-navy-600">
                {result.önerilen_aksiyonlar.map((action, i) => (
                  <li key={i}>{action}</li>
                ))}
              </ul>
            )}
            <p className="text-[10px] text-navy-400">
              Yerel model: {result.model} {result.adapter_loaded ? "(ince ayarlı adaptör)" : "(temel model + few-shot)"}
            </p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** Atanan ekip + AI skor kirilimi ("Neden bu ekip?") — atama aciklanabilirligi. */
function AssignmentCard({ incident }: { incident: Incident }) {
  const detail = incident.assignmentDetail;
  if (!incident.assignedTeamId) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Atanan Ekip</CardTitle>
        {detail?.method && (
          <span className="flex items-center gap-1 rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-semibold text-navy-500">
            <BrainCircuit className="h-3 w-3" />
            {detail.method === "AI" ? "AI ataması" : "Manuel atama"}
          </span>
        )}
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy-900 text-sm font-semibold text-white">
            {(incident.assignedTeamName ?? "?").charAt(0)}
          </div>
          <div>
            <p className="text-sm font-semibold text-navy-900">{incident.assignedTeamName ?? incident.assignedTeamId.slice(0, 8)}</p>
            {detail?.distance_km != null && (
              <p className="text-xs text-navy-400">Vaka konumuna {detail.distance_km.toFixed(1)} km</p>
            )}
          </div>
        </div>

        {detail?.method === "AI" && detail.score != null && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">Neden bu ekip? — Skor kırılımı</p>
            <ScoreBar label="Uzmanlık eşleşme" value={detail.uzmanlik_eslesme ?? 0} weight="×0.4" />
            <ScoreBar label="Mesafe yakınlık" value={detail.mesafe_yakinlik ?? 0} weight="×0.3" />
            <ScoreBar label="Kapasite boşluğu" value={detail.bosluk_orani ?? 0} weight="×0.3" />
            <div className="flex items-center justify-between border-t border-navy-100/70 pt-2 text-xs">
              <span className="font-medium text-navy-500">Toplam skor</span>
              <span className="font-mono font-semibold text-navy-900">{detail.score.toFixed(2)}</span>
            </div>
            {detail.candidates && detail.candidates.length > 1 && (
              <div className="pt-1">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-navy-400">
                  Değerlendirilen alternatifler ({detail.candidates_evaluated})
                </p>
                <div className="space-y-1">
                  {detail.candidates.slice(0, 4).map((c) => (
                    <div key={c.team_id} className="flex items-center justify-between text-[11px]">
                      <span className={c.team_id === incident.assignedTeamId ? "font-semibold text-navy-800" : "text-navy-500"}>
                        {c.name ?? c.team_id.slice(0, 8)}
                        {!c.has_capacity && <span className="ml-1 text-priority-kritik">(dolu)</span>}
                      </span>
                      <span className="font-mono text-navy-600">{c.score.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {(incident.etaTravelMinutes != null || incident.etaWorkMinutes != null) && (
          <div className="rounded-xl bg-surface-subtle p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-navy-400">ETA Modeli Tahmini</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <EtaChip icon={Truck} label="Yol" minutes={incident.etaTravelMinutes} />
              <EtaChip icon={Wrench} label="Saha işi" minutes={incident.etaWorkMinutes} />
              <EtaChip icon={Timer} label="Toplam" minutes={incident.etaTotalMinutes} highlight />
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function ScoreBar({ label, value, weight }: { label: string; value: number; weight: string }) {
  return (
    <div>
      <div className="mb-0.5 flex items-center justify-between text-[11px]">
        <span className="text-navy-500">
          {label} <span className="text-navy-300">{weight}</span>
        </span>
        <span className="font-mono font-medium text-navy-700">{value.toFixed(2)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy-50">
        <motion.div
          className="h-full rounded-full bg-navy-500"
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, value * 100)}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function EtaChip({ icon: Icon, label, minutes, highlight }: { icon: typeof Truck; label: string; minutes: number | null; highlight?: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-1.5 ${highlight ? "bg-navy-900 text-white" : "bg-white text-navy-700"}`}>
      <Icon className={`mx-auto h-3.5 w-3.5 ${highlight ? "text-brand-yellow" : "text-navy-400"}`} />
      <p className={`mt-0.5 text-xs font-semibold ${highlight ? "" : "text-navy-900"}`}>
        {minutes != null ? `~${Math.round(minutes)} dk` : "—"}
      </p>
      <p className={`text-[10px] ${highlight ? "text-navy-300" : "text-navy-400"}`}>{label}</p>
    </div>
  );
}

/** Saha operasyonu canli durumu: YOLDA'da varis geri sayimi + ilerleme, sahada is suresi takibi. */
function FieldOperationCard({ incident }: { incident: Incident }) {
  const [, forceTick] = useState(0);
  const live = incident.status === "YOLDA" || incident.status === "MUDAHALE_EDILIYOR";

  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => forceTick((v) => v + 1), 5000);
    return () => clearInterval(t);
  }, [live]);

  const progressInfo = useMemo(() => {
    const now = Date.now();
    if (incident.status === "YOLDA" && incident.departedAt && incident.etaTravelMinutes) {
      const elapsedMin = (now - new Date(incident.departedAt).getTime()) / 60000;
      const pct = Math.min(97, Math.max(2, (elapsedMin / incident.etaTravelMinutes) * 100));
      const kalan = Math.max(0, Math.round(incident.etaTravelMinutes - elapsedMin));
      return { title: "Ekip yolda", sub: `Tahmini varışa ~${kalan} dk`, pct, icon: Navigation };
    }
    if (incident.status === "MUDAHALE_EDILIYOR" && incident.arrivedAt && incident.etaWorkMinutes) {
      const elapsedMin = (now - new Date(incident.arrivedAt).getTime()) / 60000;
      const pct = Math.min(97, Math.max(2, (elapsedMin / incident.etaWorkMinutes) * 100));
      const kalan = Math.max(0, Math.round(incident.etaWorkMinutes - elapsedMin));
      return { title: "Sahada müdahale sürüyor", sub: `Tahmini tamamlanmaya ~${kalan} dk`, pct, icon: Wrench };
    }
    return null;
  }, [incident]);

  if (!progressInfo) return null;
  const Icon = progressInfo.icon;

  return (
    <Card>
      <CardBody className="pt-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900">
            <Icon className="h-5 w-5 text-brand-yellow" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-navy-900">{progressInfo.title}</p>
              <span className="font-mono text-xs font-semibold text-navy-600">%{Math.round(progressInfo.pct)}</span>
            </div>
            <p className="text-xs text-navy-400">{progressInfo.sub} · haritada canlı izlenebilir</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-navy-50">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-navy-500 to-navy-900"
                animate={{ width: `${progressInfo.pct}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

/** Vaka yasam dongusu zaman cizelgesi (durum gecis gecmisi). */
function TimelineCard({ incident, history }: { incident: Incident; history: IncidentHistoryEntry[] }) {
  const entries = useMemo(() => {
    const items: { key: string; label: string; sub?: string; at: string }[] = [
      { key: "created", label: "Vaka oluşturuldu", sub: incident.aiProbability != null ? `AI olasılığı %${Math.round(incident.aiProbability * 100)}` : undefined, at: incident.createdAt },
      ...history.map((h) => ({
        key: h.id,
        label: `${STATUS_LABELS[h.fromStatus]} → ${STATUS_LABELS[h.toStatus]}`,
        sub: h.reason ?? undefined,
        at: h.changedAt,
      })),
    ];
    return items;
  }, [incident, history]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zaman Çizelgesi</CardTitle>
        <Route className="h-4 w-4 text-navy-300" />
      </CardHeader>
      <CardBody>
        <ol className="relative space-y-4 border-l border-navy-100 pl-4">
          {entries.map((entry, i) => (
            <li key={entry.key} className="relative">
              <span
                className={`absolute -left-[21.5px] top-0.5 flex h-3 w-3 items-center justify-center rounded-full border-2 border-white ${
                  i === entries.length - 1 ? "bg-navy-900" : "bg-navy-300"
                }`}
              >
                {i === entries.length - 1 && <CheckCircle2 className="h-2 w-2 text-white" />}
              </span>
              <p className="text-xs font-semibold text-navy-800">{entry.label}</p>
              {entry.sub && <p className="text-[11px] text-navy-400">{entry.sub}</p>}
              <p className="mt-0.5 flex items-center gap-1 text-[10px] text-navy-300">
                <Users className="h-2.5 w-2.5" />
                {format(new Date(entry.at), "d MMM HH:mm", { locale: tr })}
              </p>
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}

function InfoStat({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-navy-400">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <div className="mt-1 text-sm font-semibold text-navy-900">{value}</div>
    </div>
  );
}
