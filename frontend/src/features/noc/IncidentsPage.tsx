import { useState } from "react";
import { PlusCircle } from "lucide-react";
import { IncidentsListPage } from "../shared/IncidentsListPage";
import { Button } from "../../components/ui/Button";
import { NocManualTelemetryModal } from "./NocManualTelemetryModal";
import { useQueryClient } from "@tanstack/react-query";

export function NocIncidentsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryClient = useQueryClient();

  return (
    <>
      <IncidentsListPage
        title="Operasyon Merkezi"
        description="Tüm şebeke: istasyonlar, aktif arızalar, saha ekipleri ve canlı rota akışı."
        basePath="/operasyon/vakalar"
        showMap
        action={
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" /> Manuel Telemetri / Arıza Girişi
          </Button>
        }
      />
      <NocManualTelemetryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["incidents"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-incidents"] });
          queryClient.invalidateQueries({ queryKey: ["stations"] });
          queryClient.invalidateQueries({ queryKey: ["ai-teams"] });
          queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
        }}
      />
    </>
  );
}
