import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, KeyRound, Radio, Send, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { extractErrorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";
import turkcellLogo from "../../assets/turkcell-logo.webp";

type Mode = "staff" | "customer";
type CustomerStep = "details" | "telegram-link" | "otp";

const LINK_POLL_INTERVAL_MS = 2500;

export function LoginPage() {
  const { loginStaff, registerCustomer, telegramLinkStatus, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("staff");
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [customerStep, setCustomerStep] = useState<CustomerStep>("details");
  const [name, setName] = useState("");
  const [surname, setSurname] = useState("");
  const [gsm, setGsm] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [telegramLinkUrl, setTelegramLinkUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goToApp = () => navigate("/", { replace: true });

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const handleStaffLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await loginStaff(email, password);
      goToApp();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Musteri OTP akisi: kod ASLA UI'da veya API yanitinda gorunmez — gercekten Telegram'a
  // gonderilir. Musteri Telegram baglamamissa once tek seferlik baglanti istenir; baglanti
  // tamamlanana kadar kisa araliklarla durum sorgulanir (bkz. auth.service.ts register()).
  const requestOtpNow = async () => {
    const result = await registerCustomer(name, surname, gsm);
    if (!result.linked) {
      setTelegramLinkUrl(result.linkUrl ?? null);
      setCustomerStep("telegram-link");
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const linked = await telegramLinkStatus(gsm).catch(() => false);
        if (linked) {
          if (pollRef.current) clearInterval(pollRef.current);
          toast.success("Telegram bağlandı, doğrulama kodu gönderiliyor...");
          try {
            await registerCustomer(name, surname, gsm);
            setCustomerStep("otp");
            toast.success("Doğrulama kodu Telegram'a gönderildi.");
          } catch (err) {
            toast.error(extractErrorMessage(err));
          }
        }
      }, LINK_POLL_INTERVAL_MS);
      return;
    }
    setCustomerStep("otp");
    toast.success(result.channel === "TELEGRAM" ? "Doğrulama kodu Telegram'a gönderildi." : "OTP kodu gönderildi.");
  };

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await requestOtpNow();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyOtp(gsm, otpCode);
      goToApp();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-surface-subtle">
      {/* Marka paneli */}
      <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-navy-950 p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <img src={turkcellLogo} alt="Turkcell" className="h-10 w-10 drop-shadow-[0_2px_10px_rgba(255,201,0,0.4)]" />
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-brand-yellow">Turkcell</p>
            <span className="text-lg font-bold leading-tight tracking-tight">NetOpsCell</span>
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="relative">
          <h1 className="max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Şebeke arızalarını yapay zekâ ile önceden görün, saha ekibinizi akıllıca yönlendirin.
          </h1>
          <p className="mt-4 max-w-sm text-sm text-navy-300">
            Turkcell şebeke altyapısı için uçtan uca arıza tahmini, saha operasyonu ve
            performans takibi tek platformda.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4">
            {[
              { icon: Sparkles, label: "AI Tahmini" },
              { icon: ShieldCheck, label: "Güvenli Erişim" },
              { icon: Radio, label: "Canlı İzleme" },
            ].map((f) => (
              <div key={f.label} className="rounded-xl bg-white/5 p-4">
                <f.icon className="h-5 w-5 text-brand-yellow" />
                <p className="mt-2 text-xs font-medium text-navy-200">{f.label}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <p className="relative text-xs text-navy-400">© 2026 NetOpsCell — Turkcell CodeNight</p>
      </div>

      {/* Form paneli */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-sm"
        >
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <img src={turkcellLogo} alt="Turkcell" className="h-9 w-9" />
            <div>
              <p className="text-[9px] font-extrabold uppercase tracking-[0.22em] text-navy-500">Turkcell</p>
              <span className="text-base font-bold leading-tight tracking-tight text-navy-950">NetOpsCell</span>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-navy-950">Hoş geldiniz</h2>
          <p className="mt-1.5 text-sm text-navy-500">Devam etmek için giriş yapın.</p>

          <div className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-navy-50 p-1">
            <button
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all",
                mode === "staff" ? "bg-white text-navy-900 shadow-soft" : "text-navy-400 hover:text-navy-600"
              )}
              onClick={() => setMode("staff")}
            >
              <KeyRound className="h-4 w-4" /> Personel
            </button>
            <button
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all",
                mode === "customer" ? "bg-white text-navy-900 shadow-soft" : "text-navy-400 hover:text-navy-600"
              )}
              onClick={() => setMode("customer")}
            >
              <Smartphone className="h-4 w-4" /> Müşteri
            </button>
          </div>

          {mode === "staff" && (
            <form onSubmit={handleStaffLogin} className="mt-6 flex flex-col gap-4">
              <Input label="E-posta" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ornek@netopscell.com" />
              <Input label="Şifre" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
              <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
                Giriş Yap
              </Button>
            </form>
          )}

          {mode === "customer" && customerStep === "details" && (
            <form onSubmit={handleRequestOtp} className="mt-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Input label="Ad" required value={name} onChange={(e) => setName(e.target.value)} />
                <Input label="Soyad" required value={surname} onChange={(e) => setSurname(e.target.value)} />
              </div>
              <Input label="GSM" required value={gsm} onChange={(e) => setGsm(e.target.value)} placeholder="05XXXXXXXXX" />
              <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
                Devam Et
              </Button>
            </form>
          )}

          {mode === "customer" && customerStep === "telegram-link" && (
            <div className="mt-6 flex flex-col gap-4">
              <div className="rounded-xl border border-navy-100 bg-surface-subtle p-4 text-center">
                <Send className="mx-auto h-8 w-8 text-navy-400" />
                <p className="mt-2.5 text-sm font-semibold text-navy-900">Telegram hesabınızı bağlayın</p>
                <p className="mt-1 text-xs leading-relaxed text-navy-500">
                  Doğrulama kodunuz güvenlik amacıyla Telegram üzerinden gönderilir. Aşağıdaki
                  düğmeye basıp Telegram'da <span className="font-medium">Başlat</span>'a
                  dokunun; bu ekran otomatik olarak devam edecektir.
                </p>
                {telegramLinkUrl && (
                  <a
                    href={telegramLinkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#229ED9] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <Send className="h-4 w-4" /> Telegram'da Aç
                  </a>
                )}
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-navy-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-navy-400" /> Bağlantı bekleniyor...
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (pollRef.current) clearInterval(pollRef.current);
                  setCustomerStep("details");
                }}
                className="text-xs font-medium text-navy-400 hover:text-navy-600"
              >
                ← Bilgileri değiştir
              </button>
            </div>
          )}

          {mode === "customer" && customerStep === "otp" && (
            <form onSubmit={handleVerifyOtp} className="mt-6 flex flex-col gap-4">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-800 ring-1 ring-inset ring-emerald-200">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Doğrulama kodu gönderildi. Telegram sohbetinizi kontrol edin.
              </div>
              <Input label="OTP Kodu" required value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="••••" maxLength={4} />
              <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
                Doğrula ve Giriş Yap
              </Button>
              <button
                type="button"
                onClick={() => setCustomerStep("details")}
                className="text-xs font-medium text-navy-400 hover:text-navy-600"
              >
                ← Bilgileri değiştir
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
