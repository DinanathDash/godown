import { apiClient } from "./client";
import { Customer, PaginatedResponse } from "@/types/api";

export interface GetCustomersParams {
  page?: number;
  limit?: number;
  q?: string;
  status?: string;
  type?: string;
  /** Comma-separated, most significant first: "name:asc,businessName:desc" */
  sort?: string;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  note: string;
  createdById: string;
  followUpDate: string | null;
  createdAt: string;
  createdBy: { name: string; email: string };
}

export const customersApi = {
  getCustomers: async (params?: GetCustomersParams) => {
    const { data } = await apiClient.get<PaginatedResponse<Customer>>(
      "/customers",
      { params },
    );
    return data;
  },

  getCustomer: async (id: string) => {
    // We expect the backend to return { customer, recentNotes, recentChallans } or similar.
    // As per PRD: `GET /customers/:id Includes last 20 follow-up notes and last 5 challans`
    // We'll type it closely to what we need
    const { data } = await apiClient.get<{
      customer: Customer;
      recentNotes: CustomerNote[];
      recentChallans: {
        id: string;
        challanNumber: string | null;
        status: string;
        createdAt: string;
        totalAmount: number;
      }[];
    }>(`/customers/${id}`);
    return data;
  },

  createCustomer: async (customerData: Partial<Customer>) => {
    const { data } = await apiClient.post<Customer>("/customers", customerData);
    return data;
  },

  updateCustomer: async (id: string, customerData: Partial<Customer>) => {
    const { data } = await apiClient.patch<Customer>(
      `/customers/${id}`,
      customerData,
    );
    return data;
  },

  deleteCustomer: async (id: string) => {
    await apiClient.delete(`/customers/${id}`);
  },

  getCustomerNotes: async (
    id: string,
    params?: { page?: number; limit?: number },
  ) => {
    const { data } = await apiClient.get<PaginatedResponse<CustomerNote>>(
      `/customers/${id}/notes`,
      { params },
    );
    return data;
  },

  addCustomerNote: async (
    id: string,
    noteData: { note: string; followUpDate?: string | null; status?: string },
  ) => {
    const { data } = await apiClient.post<CustomerNote>(
      `/customers/${id}/notes`,
      noteData,
    );
    return data;
  },
};
