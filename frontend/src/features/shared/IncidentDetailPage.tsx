import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { motion } from "framer-motion";
import { ArrowLeft, Check, CheckCheck, Gauge, MapPin, MessageSquare, Send, Star, Zap } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Card, CardBody, CardHeader, CardTitle } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { FaultTypeBadge, PriorityBadge, StatusBadge } from "../../components/ui/Badge";
import { ErrorState, LoadingState } from "../../components/ui/States";
import { IncidentMap } from "../../components/map/IncidentMap";
import { extractErrorMessage } from "../../lib/api";
import { SlaCountdown } from "./SlaCountdown";
import {
  useConfirmAssign,
  useCreateResolution,
  useIncident,
  useIncidentMessages,
  useIncidentResolution,
  useMarkMessagesRead,
  useRateResolution,
  useSendMessage,
  useUpdateStatus,
} from "./incidentHooks";

const NEXT_STATUS: Record<string, { label: string; status: string }[]> = {
  ATANDI: [{ label: "Sahaya Hareket Et", status: "YOLDA" }],
  YOLDA: [{ label: "Sahaya Ulaştım", status: "MUDAHALE_EDILIYOR" }],
  MUDAHALE_EDILIYOR: [{ label: "Parça Bekleniyor", status: "PARCA_BEKLENIYOR" }],
  PARCA_BEKLENIYOR: [{ label: "Parça Tedarik Edildi", status: "MUDAHALE_EDILIYOR" }],
};

export function IncidentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: incident, isLoading, isError, refetch } = useIncident(id);
  const { data: messages } = useIncidentMessages(id);
  const { data: resolution } = useIncidentResolution(id, incident?.status === "COZULDU" || incident?.status === "KAPANDI");

  const updateStatus = useUpdateStatus(id);
  const confirmAssign = useConfirmAssign(id);
  const createResolution = useCreateResolution(id);
  const rateResolution = useRateResolution(id);
  const sendMessage = useSendMessage(id);
  const markMessagesRead = useMarkMessagesRead(id);

  const [messageText, setMessageText] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [rating, setRating] = useState(5);
  const [isPermanent, setIsPermanent] = useState(true);

  const role = user?.role;
  const canMessage = role === "SAHA_TEKNISYENI" || role === "NOC_OPERATORU" || role === "SUPERVIZOR";

  // Thread'i goruntuleyen kullanici icin okundu bilgisini isaretler (bkz. Incident Service
  // messaging.service.ts - MongoDB tabanli okuma bilgisi/read receipt).
  useEffect(() => {
    if (canMessage && messages && messages.length > 0) {
      markMessagesRead.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canMessage, messages?.length]);

  if (isLoading) return <LoadingState label="Vaka detayı yükleniyor..." />;
  if (isError || !incident) return <ErrorState message="Vaka bulunamadı." onRetry={() => refetch()} />;

  const isAssignedTech = role === "SAHA_TEKNISYENI" && incident.assignedTeamId === user?.id;
  const canTransition = (isAssignedTech || role === "SUPERVIZOR") && NEXT_STATUS[incident.status];
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
              <InfoStat icon={MessageSquare} label="Atanan Ekip" value={incident.assignedTeamId ? incident.assignedTeamId.slice(0, 8) : "Atanmadı"} />
            </CardBody>
          </Card>

          {incident.latitude && incident.longitude && (
            <Card className="overflow-hidden p-0">
              <IncidentMap incidents={[incident]} center={[incident.latitude, incident.longitude]} zoom={13} height={280} />
            </Card>
          )}

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

          {canMessage && (
            <Card>
              <CardHeader>
                <CardTitle>Saha İletişimi</CardTitle>
              </CardHeader>
              <CardBody>
                <div className="mb-3 max-h-64 space-y-3 overflow-y-auto scrollbar-thin">
                  {messages?.length === 0 && <p className="text-xs text-navy-400">Henüz mesaj yok.</p>}
                  {messages?.map((m) => {
                    const isOwn = m.senderId === user?.id;
                    return (
                      <div key={m._id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                            isOwn ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-800"
                          }`}
                        >
                          {m.content}
                          <p
                            className={`mt-1 flex items-center gap-1 text-[10px] ${
                              isOwn ? "text-navy-300" : "text-navy-400"
                            }`}
                          >
                            {formatDistanceToNow(new Date(m.createdAt), { addSuffix: true, locale: tr })}
                            {isOwn &&
                              (m.status === "READ" ? (
                                <CheckCheck className="h-3 w-3 text-brand-yellow" />
                              ) : (
                                <Check className="h-3 w-3" />
                              ))}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!messageText.trim()) return;
                    sendMessage.mutate(messageText, { onSuccess: () => setMessageText("") });
                  }}
                >
                  <Input className="flex-1" value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Mesaj yazın..." />
                  <Button type="submit" size="md" loading={sendMessage.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </CardBody>
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

          {canTransition && (
            <Card>
              <CardHeader>
                <CardTitle>Durum Güncelle</CardTitle>
              </CardHeader>
              <CardBody className="flex flex-col gap-2">
                {NEXT_STATUS[incident.status].map((next) => (
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
        </div>
      </div>
    </div>
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
