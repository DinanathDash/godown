import { apiClient } from "./client";
import { PaginatedResponse, Challan } from "@/types/api";

export interface GetChallansParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  customerId?: string;
  from?: string;
  to?: string;
}

export interface CreateChallanInput {
  customerId: string;
  status?: "DRAFT" | "CONFIRMED";
  notes?: string;
  items: {
    productId: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export const challansApi = {
  getChallans: async (params?: GetChallansParams) => {
    const { data } = await apiClient.get<PaginatedResponse<Challan>>(
      "/challans",
      { params },
    );
    return data;
  },

  getChallan: async (id: string) => {
    const { data } = await apiClient.get<Challan>(`/challans/${id}`);
    return data;
  },

  createChallan: async (challanData: CreateChallanInput) => {
    const { data } = await apiClient.post<Challan>("/challans", challanData);
    return data;
  },

  updateChallan: async (id: string, challanData: CreateChallanInput) => {
    const { data } = await apiClient.patch<Challan>(
      `/challans/${id}`,
      challanData,
    );
    return data;
  },

  confirmChallan: async (id: string) => {
    const { data } = await apiClient.post<{
      message: string;
      challan: Challan;
    }>(`/challans/${id}/confirm`);
    return data;
  },

  cancelChallan: async (id: string) => {
    const { data } = await apiClient.post<{
      message: string;
      challan: Challan;
    }>(`/challans/${id}/cancel`);
    return data;
  },
};
