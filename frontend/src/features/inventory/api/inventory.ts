import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/api/client";
import { PaginatedResponse, InventoryItem } from "@/types/api";

export interface GetInventoryParams {
  page?: number;
  limit?: number;
  locationId?: string;
  itemId?: string;
  categoryId?: string;
  search?: string;
  availability?: "ALL" | "IN_STOCK" | "OUT_OF_STOCK";
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

/** Reference lists for the filter selects. Small and stable, so cached hard. */
export const useLocations = () =>
  useQuery({
    queryKey: ["locations"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await apiClient.get<{
        data: { id: string; code: string; name: string }[];
      }>("/locations");
      return data.data;
    },
  });

export const useCategories = () =>
  useQuery({
    queryKey: ["categories"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: { id: string; name: string }[] }>(
        "/categories",
      );
      return data.data;
    },
  });
