import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { AuditLogEntry, Personnel, Role } from "../../types";

export function useAuditLogs() {
  return useQuery({
    queryKey: ["audit-logs"],
    queryFn: async () => {
      const response = await api.get<{ data: AuditLogEntry[] }>("/api/v1/admin/audit-logs?limit=100");
      return response.data.data;
    },
    refetchInterval: 20000,
  });
}

export function usePersonnel() {
  return useQuery({
    queryKey: ["personnel"],
    queryFn: async () => {
      const response = await api.get<{ data: Personnel[] }>("/api/v1/admin/personnel");
      return response.data.data;
    },
  });
}

export interface CreatePersonnelInput {
  name: string;
  surname: string;
  email: string;
  password: string;
  role: Role;
  expertise?: string[];
  region?: string[];
  latitude?: number;
  longitude?: number;
}

export interface UpdatePersonnelInput {
  id: string;
  name?: string;
  surname?: string;
  email?: string;
  password?: string;
  role?: Role;
  expertise?: string[];
  region?: string[];
  status?: "ACTIVE" | "INACTIVE" | "LOCKED";
  latitude?: number;
  longitude?: number;
}

export function useCreatePersonnel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreatePersonnelInput) => {
      const response = await api.post<{ data: Personnel }>("/api/v1/admin/personnel", input);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["ai-teams"] });
    },
  });
}

export function useUpdatePersonnel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdatePersonnelInput) => {
      const response = await api.patch<{ data: Personnel }>(`/api/v1/admin/personnel/${id}`, input);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["ai-teams"] });
    },
  });
}

export function useDeletePersonnel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.delete<{ data: { deleted: boolean; id: string } }>(`/api/v1/admin/personnel/${id}`);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel"] });
      queryClient.invalidateQueries({ queryKey: ["ai-teams"] });
    },
  });
}
