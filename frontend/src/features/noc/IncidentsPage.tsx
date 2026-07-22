import { IncidentsListPage } from "../shared/IncidentsListPage";

export function NocIncidentsPage() {
  return (
    <IncidentsListPage
      title="Operasyon Merkezi"
      description="Tüm şebeke: istasyonlar, aktif arızalar, saha ekipleri ve canlı rota akışı."
      basePath="/operasyon/vakalar"
      showMap
    />
  );
}
