import { useState, type FormEvent } from "react";
import { Edit2, Plus, Trash2, UserCheck, UserCog, UserX } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";
import { Input, Select } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { extractErrorMessage } from "../../lib/api";
import { useCreatePersonnel, useDeletePersonnel, usePersonnel, useUpdatePersonnel } from "./adminHooks";
import { ROLE_LABELS } from "../../components/layout/navConfig";
import type { Personnel, Role } from "../../types";

const STAFF_ROLES: Role[] = ["SAHA_TEKNISYENI", "NOC_OPERATORU", "SUPERVIZOR", "ADMIN"];
const FAULT_TYPES = ["DONANIM", "GUC_KESINTISI", "BAGLANTI", "YAZILIM", "ISINMA"];
const PRESET_REGIONS = ["Kadıköy", "Üsküdar", "Ataşehir", "Beşiktaş", "Şişli", "Bakırköy", "Ümraniye", "Maslak", "Anadolu", "Avrupa"];

export function PersonnelPage() {
  const { data: personnel, isLoading, isError, refetch } = usePersonnel();
  const createPersonnel = useCreatePersonnel();
  const updatePersonnel = useUpdatePersonnel();
  const deletePersonnel = useDeletePersonnel();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editPersonnel, setEditPersonnel] = useState<Personnel | null>(null);

  // Form states
  const [form, setForm] = useState({
    name: "",
    surname: "",
    email: "",
    password: "",
    role: "SAHA_TEKNISYENI" as Role,
    expertise: [] as string[],
    region: [] as string[],
  });

  const [editForm, setEditForm] = useState({
    id: "",
    name: "",
    surname: "",
    email: "",
    password: "",
    role: "SAHA_TEKNISYENI" as Role,
    expertise: [] as string[],
    region: [] as string[],
    status: "ACTIVE" as "ACTIVE" | "INACTIVE" | "LOCKED",
  });

  const toggleFormExpertise = (type: string) => {
    setForm((prev) => ({
      ...prev,
      expertise: prev.expertise.includes(type) ? prev.expertise.filter((e) => e !== type) : [...prev.expertise, type],
    }));
  };

  const toggleFormRegion = (reg: string) => {
    setForm((prev) => ({
      ...prev,
      region: prev.region.includes(reg) ? prev.region.filter((r) => r !== reg) : [...prev.region, reg],
    }));
  };

  const toggleEditExpertise = (type: string) => {
    setEditForm((prev) => ({
      ...prev,
      expertise: prev.expertise.includes(type) ? prev.expertise.filter((e) => e !== type) : [...prev.expertise, type],
    }));
  };

  const toggleEditRegion = (reg: string) => {
    setEditForm((prev) => ({
      ...prev,
      region: prev.region.includes(reg) ? prev.region.filter((r) => r !== reg) : [...prev.region, reg],
    }));
  };

  const handleCreateSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await createPersonnel.mutateAsync({
        name: form.name,
        surname: form.surname,
        email: form.email,
        password: form.password,
        role: form.role,
        expertise: form.expertise.length ? form.expertise : undefined,
        region: form.region.length ? form.region : undefined,
      });
      toast.success("Personel hesabı başarıyla oluşturuldu.");
      setCreateModalOpen(false);
      setForm({ name: "", surname: "", email: "", password: "", role: "SAHA_TEKNISYENI", expertise: [], region: [] });
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleEditClick = (p: Personnel) => {
    setEditPersonnel(p);
    setEditForm({
      id: p.id,
      name: p.name,
      surname: p.surname,
      email: p.email || "",
      password: "",
      role: p.role,
      expertise: p.expertise || [],
      region: p.region || [],
      status: (p.status as "ACTIVE" | "INACTIVE" | "LOCKED") || "ACTIVE",
    });
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editPersonnel) return;
    try {
      await updatePersonnel.mutateAsync({
        id: editForm.id,
        name: editForm.name,
        surname: editForm.surname,
        email: editForm.email,
        role: editForm.role,
        expertise: editForm.expertise,
        region: editForm.region,
        status: editForm.status,
        ...(editForm.password.trim().length >= 8 ? { password: editForm.password } : {}),
      });
      toast.success("Personel bilgileri güncellendi.");
      setEditPersonnel(null);
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`${name} isimli personeli pasife almak istediğinizden emin misiniz?`)) return;
    try {
      await deletePersonnel.mutateAsync(id);
      toast.success("Personel pasife alındı.");
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title="Personel Yönetimi"
        description="Saha teknisyeni, NOC operatörü, süpervizör ve admin hesaplarını oluşturun, düzenleyin ve yetkilendirin."
        action={
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4" /> Yeni Personel Oluştur
          </Button>
        }
      />

      <Card className="overflow-hidden">
        {isLoading && <LoadingState label="Personel listesi yükleniyor..." />}
        {isError && <ErrorState message="Personel listesi alınamadı." onRetry={() => refetch()} />}
        {!isLoading && !isError && personnel?.length === 0 && (
          <EmptyState icon={<UserCog className="h-6 w-6 text-navy-300" />} title="Henüz personel kaydı yok" />
        )}
        {!isLoading && !isError && personnel && personnel.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-navy-100 bg-navy-50/50 text-xs font-semibold text-navy-600">
                  <th className="px-5 py-3.5">Ad Soyad</th>
                  <th className="px-5 py-3.5">E-posta</th>
                  <th className="px-5 py-3.5">Rol</th>
                  <th className="px-5 py-3.5">Uzmanlık</th>
                  <th className="px-5 py-3.5">Atanan Bölgeler</th>
                  <th className="px-5 py-3.5">Durum</th>
                  <th className="px-5 py-3.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-navy-100/70">
                {personnel.map((p) => {
                  const isActive = p.status === "ACTIVE" || !p.status;
                  return (
                    <tr key={p.id} className="transition-colors hover:bg-navy-50/40">
                      <td className="px-5 py-3.5 font-semibold text-navy-900">
                        {p.name} {p.surname}
                      </td>
                      <td className="px-5 py-3.5 text-navy-600 font-mono text-xs">{p.email || "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center rounded-full bg-navy-100 px-2.5 py-1 text-xs font-medium text-navy-800">
                          {ROLE_LABELS[p.role]}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-navy-600">
                        {p.expertise && p.expertise.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.expertise.map((exp) => (
                              <span key={exp} className="rounded-md bg-navy-50 px-2 py-0.5 text-[11px] font-medium text-navy-700 border border-navy-100">
                                {exp}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-navy-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-navy-600">
                        {p.region && p.region.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {p.region.map((reg) => (
                              <span key={reg} className="rounded-md bg-emerald-50 text-emerald-800 px-2 py-0.5 text-[11px] font-medium border border-emerald-100">
                                {reg}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-navy-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                            <UserCheck className="h-3.5 w-3.5" /> Aktif
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-navy-400">
                            <UserX className="h-3.5 w-3.5" /> Pasif
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleEditClick(p)}
                            className="flex items-center gap-1 rounded-lg border border-navy-100 bg-white px-2.5 py-1.5 text-xs font-medium text-navy-700 shadow-soft hover:bg-navy-50"
                            title="Düzenle"
                          >
                            <Edit2 className="h-3.5 w-3.5 text-navy-500" /> Düzenle
                          </button>
                          {isActive && (
                            <button
                              onClick={() => handleDelete(p.id, `${p.name} ${p.surname}`)}
                              className="flex items-center gap-1 rounded-lg border border-red-100 bg-red-50/50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100/70"
                              title="Pasife Al"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-500" /> Pasife Al
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Yeni Personel Oluştur Modalı */}
      <Modal open={createModalOpen} onClose={() => setCreateModalOpen(false)} title="Yeni Personel Oluştur">
        <form onSubmit={handleCreateSubmit} className="flex flex-col gap-3.5">
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
            placeholder="En az 8 karakter, 1 büyük harf, 1 rakam, 1 özel karakter"
          />
          <p className="text-[11px] text-navy-400 -mt-2">
            Şifre Politikası: En az 8 karakter, 1 büyük harf (A-Z), 1 rakam (0-9) ve 1 özel karakter zorunludur.
          </p>

          <Select label="Rol" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>

          {/* Uzmanlık Alanları (Çoklu Seçim) */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-navy-700">
              Uzmanlık Alanları <span className="font-normal text-navy-400">(Birden fazla seçilebilir)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {FAULT_TYPES.map((type) => {
                const selected = form.expertise.includes(type);
                return (
                  <button
                    type="button"
                    key={type}
                    onClick={() => toggleFormExpertise(type)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                      selected
                        ? "border-navy-900 bg-navy-900 text-white shadow-soft"
                        : "border-navy-100 bg-white text-navy-600 hover:bg-navy-50"
                    }`}
                  >
                    {selected ? "✓ " : ""}{type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Atanan Bölgeler (Çoklu Seçim) */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-navy-700">
              Saha / Hizmet Bölgeleri <span className="font-normal text-navy-400">(Birden fazla seçilebilir)</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_REGIONS.map((reg) => {
                const selected = form.region.includes(reg);
                return (
                  <button
                    type="button"
                    key={reg}
                    onClick={() => toggleFormRegion(reg)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ${
                      selected
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-soft"
                        : "border-navy-100 bg-white text-navy-600 hover:bg-navy-50"
                    }`}
                  >
                    {selected ? "✓ " : ""}{reg}
                  </button>
                );
              })}
            </div>
          </div>

          <Button type="submit" size="lg" loading={createPersonnel.isPending} className="mt-2 w-full">
            Personel Hesabını Oluştur
          </Button>
        </form>
      </Modal>

      {/* Personel Düzenle Modalı */}
      <Modal open={Boolean(editPersonnel)} onClose={() => setEditPersonnel(null)} title="Personel Bilgilerini Düzenle">
        <form onSubmit={handleEditSubmit} className="flex flex-col gap-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Ad" required value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            <Input label="Soyad" required value={editForm.surname} onChange={(e) => setEditForm({ ...editForm, surname: e.target.value })} />
          </div>
          <Input label="E-posta" type="email" required value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          
          <Input
            label="Yeni Şifre (Opsiyonel)"
            type="password"
            value={editForm.password}
            onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            placeholder="Değiştirmek istemiyorsanız boş bırakın"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select label="Rol" value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as Role })}>
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
            <Select label="Hesap Durumu" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Pasif</option>
              <option value="LOCKED">Kilitli</option>
            </Select>
          </div>

          {/* Uzmanlık Alanları (Çoklu Seçim) */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-navy-700">Uzmanlık Alanları</label>
            <div className="flex flex-wrap gap-1.5">
              {FAULT_TYPES.map((type) => {
                const selected = editForm.expertise.includes(type);
                return (
                  <button
                    type="button"
                    key={type}
                    onClick={() => toggleEditExpertise(type)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                      selected
                        ? "border-navy-900 bg-navy-900 text-white shadow-soft"
                        : "border-navy-100 bg-white text-navy-600 hover:bg-navy-50"
                    }`}
                  >
                    {selected ? "✓ " : ""}{type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bölgeler (Çoklu Seçim) */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-navy-700">Saha / Hizmet Bölgeleri</label>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_REGIONS.map((reg) => {
                const selected = editForm.region.includes(reg);
                return (
                  <button
                    type="button"
                    key={reg}
                    onClick={() => toggleEditRegion(reg)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-medium border transition-colors ${
                      selected
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-soft"
                        : "border-navy-100 bg-white text-navy-600 hover:bg-navy-50"
                    }`}
                  >
                    {selected ? "✓ " : ""}{reg}
                  </button>
                );
              })}
            </div>
          </div>

          <Button type="submit" size="lg" loading={updatePersonnel.isPending} className="mt-2 w-full">
            Değişiklikleri Kaydet
          </Button>
        </form>
      </Modal>
    </div>
  );
}
