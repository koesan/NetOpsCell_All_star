import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { BadgeCatalogItem, GamificationProfile, LeaderboardEntry } from "../../types";

export function useMyProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["gamification-profile", userId],
    queryFn: async () => {
      const response = await api.get<{ data: GamificationProfile }>(`/api/v1/game/profile/${userId}`);
      return response.data.data;
    },
    enabled: !!userId,
  });
}

export function useLeaderboard(period: "daily" | "weekly") {
  return useQuery({
    queryKey: ["leaderboard", period],
    queryFn: async () => {
      const response = await api.get<{ data: LeaderboardEntry[] }>(`/api/v1/game/leaderboard?period=${period}`);
      return response.data.data;
    },
    refetchInterval: 15000,
  });
}

export function useBadgeCatalog() {
  return useQuery({
    queryKey: ["badge-catalog"],
    queryFn: async () => {
      const response = await api.get<{ data: BadgeCatalogItem[] }>("/api/v1/game/badges");
      return response.data.data;
    },
    staleTime: Infinity,
  });
}
