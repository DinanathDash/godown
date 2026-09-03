import { apiClient } from "./client";
import { PaginatedResponse, Product, StockMovement } from "@/types/api";

export interface GetProductsParams {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  lowStock?: boolean;
}

export interface AdjustStockParams {
  type: "IN" | "OUT";
  quantity: number;
  reason: string;
}

export const productsApi = {
  getProducts: async (params?: GetProductsParams) => {
    const { data } = await apiClient.get<PaginatedResponse<Product>>(
      "/products",
      { params },
    );
    return data;
  },

  getProduct: async (id: string) => {
    // Expected to return { product, recentMovements }
    const { data } = await apiClient.get<{
      product: Product;
      recentMovements: StockMovement[];
    }>(`/products/${id}`);
    return data;
  },

  createProduct: async (
    productData: Partial<Product> & { openingStock?: number },
  ) => {
    const { data } = await apiClient.post<Product>("/products", productData);
    return data;
  },

  updateProduct: async (id: string, productData: Partial<Product>) => {
    const { data } = await apiClient.patch<Product>(
      `/products/${id}`,
      productData,
    );
    return data;
  },

  deleteProduct: async (id: string) => {
    const { data } = await apiClient.delete(`/products/${id}`);
    return data;
  },

  adjustStock: async (id: string, adjustData: AdjustStockParams) => {
    const { data } = await apiClient.post<{
      message: string;
      movement: StockMovement;
    }>(`/products/${id}/adjust`, adjustData);
    return data;
  },
};
