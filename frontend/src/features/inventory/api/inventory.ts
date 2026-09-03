import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { PaginatedResponse, InventoryItem } from "@/types/api";

export interface GetInventoryParams {
  page?: number;
  limit?: number;
  locationId?: string;
  itemId?: string;
}

export const useInventory = (params: GetInventoryParams) => {
  return useQuery({
    queryKey: ["inventory", params],
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedResponse<InventoryItem>>(
        "/inventory",
        {
          params,
        },
      );
      return data;
    },
  });
};

export const useAdjustStock = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      inventoryItemId: string;
      type: "IN" | "OUT";
      quantity: number;
      reason: string;
    }) => {
      const res = await apiClient.post("/inventory/adjust", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
};
