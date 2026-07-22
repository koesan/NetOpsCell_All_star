import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { AiAccuracy, DashboardSummary } from "../../types";

export function useDashboardSummary() {
  return useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const response = await api.get<{ data: DashboardSummary }>("/api/v1/dashboard/summary");
      return response.data.data;
    },
    refetchInterval: 20000,
  });
}

export function useAiAccuracy() {
  return useQuery({
    queryKey: ["ai-accuracy"],
    queryFn: async () => {
      // Gateway uzerinden gider (JWT dogrulamasi + tek giris noktasi ilkesi korunur)
      const response = await api.get<{ data: AiAccuracy }>("/api/v1/ai/accuracy");
      return response.data.data;
    },
    retry: 1,
  });
}
