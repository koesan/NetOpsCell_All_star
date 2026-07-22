import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import { getAccessToken } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";
import type { BadgeCatalogItem } from "../types";

interface IncidentAssignedPayload {
  incident_id: string;
  team_id: string;
}

interface BadgeEarnedPayload {
  user_id: string;
  badge_code: string;
}

/**
 * Faz 4 (bonus): oturum acikken Gateway'in Socket.IO relay'ine baglanir, kullaniciya ozel
 * (user:<id> odasi) bildirimleri dinler ve toast + ilgili React Query cache'lerini
 * gecersiz kilarak (invalidate) veri en yeni haliyle gorunur - sayfa yenilemesi veya bir
 * sonraki polling turu beklenmez. Bkz. gateway/src/websocket.js, EVENTS.md.
 */
export function useRealtimeNotifications(): void {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const token = getAccessToken();
    if (!token) return;

    const socket = connectSocket(token);

    socket.on("incident:assigned", (payload: IncidentAssignedPayload) => {
      if (payload.team_id !== user.id) return;
      toast.info(`Size yeni bir arıza atandı: ${payload.incident_id}`);
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-incidents"] });
    });

    socket.on("badge:earned", (payload: BadgeEarnedPayload) => {
      if (payload.user_id !== user.id) return;
      const catalog = queryClient.getQueryData<BadgeCatalogItem[]>(["badge-catalog"]);
      const badgeName = catalog?.find((b) => b.code === payload.badge_code)?.name ?? payload.badge_code;
      toast.success(`Yeni rozet kazandınız: ${badgeName}`);
      queryClient.invalidateQueries({ queryKey: ["gamification-profile", user.id] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    });

    return () => {
      disconnectSocket();
    };
  }, [user, queryClient]);
}
