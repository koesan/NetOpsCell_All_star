import { useEffect, useMemo, useRef, useState } from "react";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { tr } from "date-fns/locale";
import { Check, CheckCheck, Clock3, Headset, Send, ShieldCheck, Sparkles, User, Wrench } from "lucide-react";
import type { IncidentMessage, Role } from "../../types";

/**
 * WhatsApp tarzi vaka mesajlasma thread'i (Saha Teknisyeni <-> NOC / Supervizor).
 *
 * - Gun ayraclari, ardisik mesaj gruplama, gonderen adi + rol rozeti
 * - Iletim durumu: tek tik (iletildi) / cift sari tik (okundu) — backend'deki
 *   MongoDB read-receipt mekanizmasinin gorsel karsiligi
 * - SYSTEM mesajlari (atama, yola cikis, varis, cozum) ortada olay pili olarak
 * - Optimistik gonderim: mesaj aninda balonda belirir, saat ikonu ile "gonderiliyor"
 */

const ROLE_META: Record<string, { label: string; className: string; icon: typeof Wrench }> = {
  SAHA_TEKNISYENI: { label: "Saha", className: "bg-emerald-100 text-emerald-700", icon: Wrench },
  NOC_OPERATORU: { label: "NOC", className: "bg-sky-100 text-sky-700", icon: Headset },
  SUPERVIZOR: { label: "Süpervizör", className: "bg-violet-100 text-violet-700", icon: ShieldCheck },
  MUSTERI: { label: "Müşteri", className: "bg-navy-100 text-navy-600", icon: User },
};

interface PendingMessage {
  localId: string;
  content: string;
  createdAt: string;
}

interface IncidentChatProps {
  messages: IncidentMessage[];
  currentUserId: string;
  currentUserRole: Role;
  onSend: (content: string) => Promise<unknown>;
  disabled?: boolean;
  height?: number;
}

function dayLabel(date: Date): string {
  if (isToday(date)) return "Bugün";
  if (isYesterday(date)) return "Dün";
  return format(date, "d MMMM yyyy", { locale: tr });
}

export function IncidentChat({ messages, currentUserId, onSend, disabled, height = 420 }: IncidentChatProps) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  // Sunucudan gelen mesajlar arasinda pending karsiligi varsa temizle
  useEffect(() => {
    setPending((prev) => prev.filter((p) => !messages.some((m) => m.content === p.content && m.senderId === currentUserId)));
  }, [messages, currentUserId]);

  const timeline = useMemo(() => {
    const all: (IncidentMessage | (PendingMessage & { isPending: true }))[] = [
      ...messages,
      ...pending.map((p) => ({ ...p, isPending: true as const })),
    ];
    return all;
  }, [messages, pending]);

  // Yeni mesajda otomatik en alta kaydir (kullanici yukari scroll etmediyse)
  useEffect(() => {
    const el = scrollRef.current;
    if (el && wasAtBottomRef.current) el.scrollTop = el.scrollHeight;
  }, [timeline.length]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    wasAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const submit = async () => {
    const content = draft.trim();
    if (!content || disabled) return;
    const local: PendingMessage = { localId: `local-${Date.now()}`, content, createdAt: new Date().toISOString() };
    setPending((prev) => [...prev, local]);
    setDraft("");
    wasAtBottomRef.current = true;
    try {
      await onSend(content);
    } catch {
      // Hata durumunda optimistik balonu geri cek — cagiran taraf toast gosterir
      setPending((prev) => prev.filter((p) => p.localId !== local.localId));
      setDraft(content);
    }
  };

  let lastDate: Date | null = null;
  let lastSender: string | null = null;

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-navy-100/70" style={{ height }}>
      <div ref={scrollRef} onScroll={handleScroll} className="nops-chat-bg flex-1 space-y-1 overflow-y-auto px-4 py-3 scrollbar-thin">
        {timeline.length === 0 && (
          <p className="mt-8 text-center text-xs text-navy-400">
            Henüz mesaj yok. Saha ekibi ve NOC bu kanal üzerinden koordine olur.
          </p>
        )}

        {timeline.map((item) => {
          const isPendingMsg = "isPending" in item;
          const createdAt = new Date(item.createdAt);
          const showDay = !lastDate || !isSameDay(lastDate, createdAt);
          lastDate = createdAt;

          if (!isPendingMsg && (item as IncidentMessage).messageType === "SYSTEM") {
            lastSender = null;
            const msg = item as IncidentMessage;
            return (
              <div key={msg._id}>
                {showDay && <DaySeparator label={dayLabel(createdAt)} />}
                <div className="my-2 flex justify-center">
                  <span className="max-w-[85%] rounded-full bg-navy-900/5 px-3 py-1 text-center text-[10.5px] leading-relaxed text-navy-500">
                    {msg.content}
                    <span className="ml-1.5 text-navy-300">{format(createdAt, "HH:mm")}</span>
                  </span>
                </div>
              </div>
            );
          }

          // Musterinin sikayet metnine Gemini'nin verdigi on analiz — sanki AI thread'e
          // bizzat yazmis gibi sol tarafta ayirt edici bir balon olarak gosterilir.
          if (!isPendingMsg && (item as IncidentMessage).messageType === "AI_ANALYSIS") {
            lastSender = null;
            const msg = item as IncidentMessage;
            const analysis = msg.analysis;
            return (
              <div key={msg._id}>
                {showDay && <DaySeparator label={dayLabel(createdAt)} />}
                <div className="mt-2.5 flex justify-start">
                  <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-brand-yellow/50 bg-brand-yellow/10 px-3.5 py-2.5 shadow-sm">
                    <div className="mb-1 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-navy-700" />
                      <span className="text-[11px] font-semibold text-navy-800">AI Ön Analiz</span>
                      {analysis && (
                        <span className="rounded-full bg-navy-900 px-1.5 py-px text-[9px] font-semibold text-brand-yellow">
                          {analysis.muhtemel_alan}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] leading-relaxed text-navy-800">
                      Büyük ihtimalle <strong>{analysis?.muhtemel_alan ?? "belirsiz bir"}</strong> alanında sorun olabilir.{" "}
                      {msg.content}
                    </p>
                    {analysis?.oneri && (
                      <p className="mt-1 text-[12px] leading-relaxed text-navy-600">
                        <span className="font-semibold">Öneri:</span> {analysis.oneri}
                      </p>
                    )}
                    <p className="mt-1 flex items-center justify-between text-[10px] text-navy-400">
                      <span>güven %{Math.round((analysis?.guven ?? 0) * 100)} · bilgilendirme amaçlıdır</span>
                      <span>{format(createdAt, "HH:mm")}</span>
                    </p>
                  </div>
                </div>
              </div>
            );
          }

          const senderId = isPendingMsg ? currentUserId : (item as IncidentMessage).senderId;
          const isOwn = senderId === currentUserId;
          const sameSenderAsPrev = lastSender === senderId && !showDay;
          lastSender = senderId;

          const msg = item as IncidentMessage & Partial<PendingMessage>;
          const roleMeta = !isOwn && !isPendingMsg ? ROLE_META[(item as IncidentMessage).senderRole] : undefined;

          return (
            <div key={isPendingMsg ? (item as PendingMessage).localId : (item as IncidentMessage)._id}>
              {showDay && <DaySeparator label={dayLabel(createdAt)} />}
              <div className={`flex ${isOwn ? "justify-end" : "justify-start"} ${sameSenderAsPrev ? "mt-0.5" : "mt-2.5"}`}>
                <div
                  className={`relative max-w-[78%] rounded-2xl px-3 py-1.5 text-[13px] leading-relaxed shadow-sm ${
                    isOwn
                      ? `bg-navy-900 text-white ${sameSenderAsPrev ? "" : "rounded-tr-md"}`
                      : `border border-navy-100/60 bg-white text-navy-800 ${sameSenderAsPrev ? "" : "rounded-tl-md"}`
                  }`}
                >
                  {!isOwn && !sameSenderAsPrev && (
                    <div className="mb-0.5 flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-navy-700">
                        {(item as IncidentMessage).senderName ?? "Personel"}
                      </span>
                      {roleMeta && (
                        <span className={`flex items-center gap-0.5 rounded-full px-1.5 py-px text-[9px] font-semibold ${roleMeta.className}`}>
                          <roleMeta.icon className="h-2.5 w-2.5" />
                          {roleMeta.label}
                        </span>
                      )}
                    </div>
                  )}
                  <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                  <span className={`ml-2 inline-flex translate-y-[3px] items-center gap-0.5 text-[10px] ${isOwn ? "text-navy-300" : "text-navy-400"}`}>
                    {format(createdAt, "HH:mm")}
                    {isOwn &&
                      (isPendingMsg ? (
                        <Clock3 className="h-3 w-3" />
                      ) : (item as IncidentMessage).status === "READ" ? (
                        <CheckCheck className="h-3.5 w-3.5 text-brand-yellow" />
                      ) : (
                        <Check className="h-3.5 w-3.5" />
                      ))}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <form
        className="flex items-center gap-2 border-t border-navy-100/70 bg-white px-3 py-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          className="h-10 flex-1 rounded-full border border-navy-100 bg-surface-subtle px-4 text-sm text-navy-900 placeholder:text-navy-300 focus:border-navy-300 focus:outline-none focus:ring-4 focus:ring-navy-100/60"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={disabled ? "Bu vakada mesaj gönderemezsiniz" : "Mesaj yazın..."}
          disabled={disabled}
          maxLength={1000}
        />
        <button
          type="submit"
          disabled={disabled || !draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-900 text-white transition-all hover:bg-navy-700 disabled:opacity-40"
          title="Gönder (Enter)"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="my-3 flex items-center justify-center">
      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-navy-400 shadow-sm">
        {label}
      </span>
    </div>
  );
}
