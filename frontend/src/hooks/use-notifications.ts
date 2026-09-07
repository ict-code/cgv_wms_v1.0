import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { NotificationsResponse } from "@/lib/types";

export function useNotifications() {
  return useQuery({
    queryKey: ["/notifications"],
    queryFn: async () => (await apiClient.get<NotificationsResponse>("/notifications", { params: { pageSize: 20 } })).data,
    refetchInterval: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => apiClient.post(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/notifications"] }),
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => apiClient.post("/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/notifications"] }),
  });
}

export function notificationEntityHref(entityType: string | null, entityId: string | null): string | null {
  if (!entityType || !entityId) return null;
  const routes: Record<string, string> = {
    receiving: "/receiving",
    issuance: "/issuance",
    transfer: "/transfers",
    adjustment: "/adjustments",
    stockCount: "/stock-counts",
  };
  const base = routes[entityType];
  return base ? `${base}/${entityId}` : null;
}
