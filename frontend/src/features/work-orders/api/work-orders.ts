import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export type WorkOrderStatus = "ASSIGNED" | "IN_PROGRESS" | "COMPLETED";

export interface WorkOrder {
  id: string;
  code: string;
  locationId: string;
  itemId: string;
  requiredQty: number;
  availableQty: number;
  shortageQty: number;
  assignedToId: string;
  status: WorkOrderStatus;
  createdAt: string;
  location: { id: string; name: string; code: string };
  item: { id: string; name: string; sku: string };
  assignedTo: { id: string; name: string; email: string };
}

export function useWorkOrders(params?: {
  page?: number;
  limit?: number;
  status?: WorkOrderStatus;
}) {
  return useQuery({
    queryKey: ["work-orders", params],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: WorkOrder[];
        meta: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>("/work-orders", { params });
      return res.data;
    },
  });
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      locationId: string;
      itemId: string;
      requiredQty: number;
      assignedToId: string;
    }) => {
      const res = await apiClient.post("/work-orders", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
    },
  });
}

export function useUpdateWorkOrderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: WorkOrderStatus;
    }) => {
      const res = await apiClient.patch(`/work-orders/${id}/status`, {
        status,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
    },
  });
}

// Reusing locations, items and users for the creation form
export function useLocations() {
  return useQuery({
    queryKey: ["locations"],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: { id: string; name: string; code: string }[];
      }>("/locations");
      return res.data.data;
    },
  });
}

export function useItems() {
  return useQuery({
    queryKey: ["items"],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: { id: string; name: string; sku: string }[];
      }>("/items");
      return res.data.data;
    },
  });
}

export function useOperationsUsers() {
  return useQuery({
    queryKey: ["users", "operations"],
    queryFn: async () => {
      // In a real app we might have a users endpoint, assuming /auth/me or a /users endpoint for admin exists.
      // Since PRD does not specify a list users endpoint, we might just mock it or assume an endpoint.
      // Actually, wait, let's fetch /users if it exists, or handle it via a known list if the backend hasn't implemented it.
      // I'll assume GET /users is a thing from Counterfoil platform layer if it's an admin.
      const res = await apiClient.get<{
        data: { id: string; name: string; email: string; role: string }[];
      }>("/users");
      return res.data.data.filter((u) => u.role === "OPERATIONS");
    },
  });
}
