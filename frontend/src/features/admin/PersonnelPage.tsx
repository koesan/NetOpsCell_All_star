import { useState, type FormEvent } from "react";
import { Plus, UserCog } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { extractErrorMessage } from "../../lib/api";
import { useCreatePersonnel, usePersonnel } from "./adminHooks";
import { ROLE_LABELS } from "../../components/layout/navConfig";
import type { Role } from "../../types";

const STAFF_ROLES: Role[] = ["SAHA_TEKNISYENI", "NOC_OPERATORU", "SUPERVIZOR", "ADMIN"];
const FAULT_TYPES = ["DONANIM", "GUC_KESINTISI", "BAGLANTI", "YAZILIM", "ISINMA"];

export function PersonnelPage() {
  const { data: personnel, isLoading, isError, refetch } = usePersonnel();
  const createPersonnel = useCreatePersonnel();
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    password: "",
    role: "SAHA_TEKNISYENI" as Role,
    expertise: [] as string[],
    region: "",
  });

  const toggleExpertise = (type: string) => {
    setForm((prev) => ({
      ...prev,
      expertise: prev.expertise.includes(type) ? prev.expertise.filter((e) => e !== type) : [...prev.expertise, type],
    }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createPersonnel.mutateAsync({
        name: form.name,
        surname: form.surname,
        email: form.email,
        password: form.password,
        role: form.role,
        expertise: form.expertise.length ? form.expertise : undefined,
        region: form.region ? [form.region] : undefined,
      });
      toast.success("Personel hesabı oluşturuldu.");
      setModalOpen(false);
      setForm({ name: "", surname: "", email: "", password: "", role: "SAHA_TEKNISYENI", expertise: [], region: "" });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Personel Yönetimi"
        description="Saha teknisyeni, NOC operatörü, süpervizör ve admin hesapları."
        action={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" /> Yeni Personel
          </Button>
        }
      />

      <Card>
        {isLoading && <LoadingState />}
        {isError && <ErrorState onRetry={() => refetch()} />}
        {!isLoading && !isError && personnel?.length === 0 && (
          <EmptyState icon={<UserCog className="h-6 w-6 text-navy-300" />} title="Henüz personel yok" />
        )}
        {!isLoading && !isError && personnel && personnel.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-100 text-left text-xs text-navy-400">
                <th className="px-5 py-3 font-medium">Ad Soyad</th>
                <th className="px-5 py-3 font-medium">E-posta</th>
                <th className="px-5 py-3 font-medium">Rol</th>
                <th className="px-5 py-3 font-medium">Uzmanlık</th>
              </tr>
            </thead>
            <tbody>
              {personnel.map((p) => (
                <tr key={p.id} className="border-b border-navy-50 last:border-0 hover:bg-navy-50/40">
                  <td className="px-5 py-3 font-medium text-navy-800">{p.name} {p.surname}</td>
                  <td className="px-5 py-3 text-navy-500">{p.email}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-700">{ROLE_LABELS[p.role]}</span>
                  </td>
                  <td className="px-5 py-3 text-navy-500">{p.expertise?.join(", ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Yeni Personel Oluştur">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ad" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input label="Soyad" required value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} />
          </div>
          <Input label="E-posta" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <Input
            label="Şifre"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="En az 8 karakter, büyük harf, rakam, özel karakter"
          />
          <Select label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>

          {form.role === "SAHA_TEKNISYENI" && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-navy-700">Uzmanlık Alanları</p>
              <div className="flex flex-wrap gap-2">
                {FAULT_TYPES.map((type) => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => toggleExpertise(type)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      form.expertise.includes(type) ? "bg-navy-900 text-white" : "bg-navy-50 text-navy-500"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Input label="Bölge" value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} placeholder="Kadıköy" />

          <Button type="submit" size="lg" loading={createPersonnel.isPending} className="mt-2 w-full">
            Oluştur
          </Button>
        </form>
      </Modal>
    </div>
  );
}
