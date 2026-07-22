import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { Incident, IncidentHistoryEntry, IncidentMessage, IncidentResolution, Station, TeamInfo } from "../../types";

/** Baz istasyonu katalogu — nadiren degisir, agresif cache. */
export function useStations() {
  return useQuery({
    queryKey: ["stations"],
    queryFn: async () => {
      const response = await api.get<{ data: Station[] }>("/api/v1/stations");
      return response.data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Saha ekibi rosteri + anlik is yuku (AI Service team_cache'inden). */
export function useTeams(enabled = true) {
  return useQuery({
    queryKey: ["ai-teams"],
    queryFn: async () => {
      const response = await api.get<{ data: TeamInfo[] }>("/api/v1/ai/teams");
      return response.data.data;
    },
    enabled,
    refetchInterval: 30000,
  });
}

/** Vaka durum gecis zaman cizelgesi. */
export function useIncidentHistory(id: string | undefined) {
  return useQuery({
    queryKey: ["incident-history", id],
    queryFn: async () => {
      const response = await api.get<{ data: IncidentHistoryEntry[] }>(`/api/v1/incidents/${id}/history`);
      return response.data.data;
    },
    enabled: !!id,
    refetchInterval: 15000,
  });
}

export function useIncidents(queryKey = "incidents") {
  return useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const response = await api.get<{ data: Incident[] }>("/api/v1/incidents");
      return response.data.data;
    },
    refetchInterval: 15000,
  });
}

export function useIncident(id: string | undefined) {
  return useQuery({
    queryKey: ["incident", id],
    queryFn: async () => {
      const response = await api.get<{ data: Incident }>(`/api/v1/incidents/${id}`);
      return response.data.data;
    },
    enabled: !!id,
    refetchInterval: 10000,
  });
}

export function useIncidentResolution(id: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["incident-resolution", id],
    queryFn: async () => {
      const response = await api.get<{ data: IncidentResolution | null }>(`/api/v1/incidents/${id}/resolution`);
      return response.data.data;
    },
    enabled: !!id && enabled,
  });
}

export function useIncidentMessages(id: string | undefined) {
  return useQuery({
    queryKey: ["incident-messages", id],
    queryFn: async () => {
      const response = await api.get<{ data: IncidentMessage[] }>(`/api/v1/incidents/${id}/messages`);
      return response.data.data;
    },
    enabled: !!id,
    refetchInterval: 4000, // WhatsApp benzeri deneyim: yakin-gercek-zamanli thread guncellemesi
  });
}

function useInvalidateIncident(id: string | undefined) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["incident", id] });
    queryClient.invalidateQueries({ queryKey: ["incidents"] });
    queryClient.invalidateQueries({ queryKey: ["incident-resolution", id] });
  };
}

export function useUpdateStatus(id: string | undefined) {
  const invalidate = useInvalidateIncident(id);
  return useMutation({
    mutationFn: async (status: string) => {
      const response = await api.patch(`/api/v1/incidents/${id}/status`, { status });
      return response.data.data as Incident;
    },
    onSuccess: invalidate,
  });
}

export function useConfirmAssign(id: string | undefined) {
  const invalidate = useInvalidateIncident(id);
  return useMutation({
    mutationFn: async () => {
      const response = await api.post(`/api/v1/incidents/${id}/confirm`);
      return response.data.data as Incident;
    },
    onSuccess: invalidate,
  });
}

export function useManualAssign(id: string | undefined) {
  const invalidate = useInvalidateIncident(id);
  return useMutation({
    mutationFn: async (teamId: string) => {
      const response = await api.patch(`/api/v1/incidents/${id}/assign`, { teamId });
      return response.data.data as Incident;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateClassification(id: string | undefined) {
  const invalidate = useInvalidateIncident(id);
  return useMutation({
    mutationFn: async (body: { faultType?: string; priority?: string }) => {
      const response = await api.patch(`/api/v1/incidents/${id}/classification`, body);
      return response.data.data as Incident;
    },
    onSuccess: invalidate,
  });
}

export function useSendMessage(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      const response = await api.post(`/api/v1/incidents/${id}/messages`, { content });
      return response.data.data as IncidentMessage;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["incident-messages", id] }),
  });
}

export function useMarkMessagesRead(id: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await api.patch(`/api/v1/incidents/${id}/messages/read`);
      return response.data.data as { markedRead: number };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["incident-messages", id] }),
  });
}

export function useCreateResolution(id: string | undefined) {
  const invalidate = useInvalidateIncident(id);
  return useMutation({
    mutationFn: async (resolutionNote: string) => {
      const response = await api.post(`/api/v1/incidents/${id}/resolution`, { resolutionNote });
      return response.data.data as Incident;
    },
    onSuccess: invalidate,
  });
}

export function useRateResolution(id: string | undefined) {
  const invalidate = useInvalidateIncident(id);
  return useMutation({
    mutationFn: async (body: { rating: number; isPermanent: boolean }) => {
      const response = await api.post(`/api/v1/incidents/${id}/resolution/rate`, body);
      return response.data.data as IncidentResolution;
    },
    onSuccess: invalidate,
  });
}
