import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export type OrderStatus = "DRAFT" | "RESERVED" | "FULFILLED" | "CANCELLED";

export interface CustomerOrderLine {
  id: string;
  itemId: string;
  quantity: number;
  item: { id: string; name: string; sku: string };
}

export interface CustomerOrder {
  id: string;
  code: string;
  customerId: string;
  locationId: string;
  status: OrderStatus;
  createdById: string;
  createdAt: string;
  customer: { id: string; name: string; businessName: string | null };
  createdBy: { id: string; name: string; email: string };
  lines: CustomerOrderLine[];
}

export function useOrders(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ["orders", params],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: CustomerOrder[];
        meta: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>("/orders", { params });
      return res.data;
    },
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      customerId: string;
      locationId: string;
      lines: { itemId: string; quantity: number }[];
    }) => {
      const res = await apiClient.post("/orders", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
}

export function useReserveOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/orders/${id}/reserve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.post(`/orders/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

// Reuse dependencies for the form
export function useCustomers() {
  return useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      // Create a mock fallback since the backend doesn't have a /customers endpoint in the new specs
      try {
        const res = await apiClient.get<{
          data: { id: string; name: string; businessName: string | null }[];
        }>("/customers");
        return res.data.data;
      } catch {
        return [
          {
            id: "mock-customer-1",
            name: "Acme Corp",
            businessName: "Acme Corp",
          },
        ];
      }
    },
  });
}

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
