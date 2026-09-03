import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";

export type TransferStatus =
  "REQUESTED" | "DISPATCHED" | "RECEIVED" | "CANCELLED";

export interface Transfer {
  id: string;
  code: string;
  itemId: string;
  batchId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: number;
  dispatchedQty: number;
  receivedQty: number;
  status: TransferStatus;
  requestedById: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
  createdAt: string;
  item: { id: string; name: string; sku: string };
  batch: { id: string; code: string };
  source: { id: string; name: string; code: string };
  destination: { id: string; name: string; code: string };
}

export function useTransfers(params: {
  page?: number;
  limit?: number;
  status?: TransferStatus;
}) {
  return useQuery({
    queryKey: ["transfers", params],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: Transfer[];
        meta: {
          page: number;
          limit: number;
          total: number;
          totalPages: number;
        };
      }>("/transfers", { params });
      return res.data;
    },
  });
}

export function useCreateTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      itemId: string;
      batchId: string;
      sourceLocationId: string;
      destinationLocationId: string;
      quantity: number;
    }) => {
      const res = await apiClient.post("/transfers", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
    },
  });
}

export function useDispatchTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transferId: string) => {
      const res = await apiClient.post(`/transfers/${transferId}/dispatch`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useReceiveTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transferId: string) => {
      const res = await apiClient.post(`/transfers/${transferId}/receive`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}

export function useCancelTransfer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transferId: string) => {
      const res = await apiClient.post(`/transfers/${transferId}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transfers"] });
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

export function useBatches() {
  return useQuery({
    queryKey: ["batches"],
    queryFn: async () => {
      const res = await apiClient.get<{
        data: { id: string; code: string; itemId: string }[];
      }>("/batches");
      return res.data.data;
    },
  });
}
