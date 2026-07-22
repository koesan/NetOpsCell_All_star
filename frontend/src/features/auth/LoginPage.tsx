import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { KeyRound, Radio, ShieldCheck, Smartphone, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { extractErrorMessage } from "../../lib/api";
import { cn } from "../../lib/cn";

type Mode = "staff" | "customer";
type CustomerStep = "details" | "otp";

export function LoginPage() {
  const { loginStaff, registerCustomer, verifyOtp } = useAuth();
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
  const [otpHint, setOtpHint] = useState<string | null>(null);

  const goToApp = () => navigate("/", { replace: true });

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

  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await registerCustomer(name, surname, gsm);
      setOtpHint(result.otpHint ?? null);
      setCustomerStep("otp");
      toast.success("OTP kodu gönderildi.");
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
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-yellow">
            <Radio className="h-6 w-6 text-navy-950" strokeWidth={2.5} />
          </div>
          <span className="text-lg font-bold tracking-tight">NetOpsCell</span>
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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-950">
              <Radio className="h-5 w-5 text-brand-yellow" />
            </div>
            <span className="text-base font-bold tracking-tight text-navy-950">NetOpsCell</span>
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
                OTP Kodu Gönder
              </Button>
            </form>
          )}

          {mode === "customer" && customerStep === "otp" && (
            <form onSubmit={handleVerifyOtp} className="mt-6 flex flex-col gap-4">
              {otpHint && (
                <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                  {otpHint}
                </div>
              )}
              <Input label="OTP Kodu" required value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="1234" maxLength={4} />
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
