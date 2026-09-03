export type Role = "ADMIN" | "OPERATIONS" | "SALES";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  locationId: string | null;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface InventoryItem {
  id: string;
  itemId: string;
  locationId: string;
  batchId: string;
  physicalQty: number;
  reservedQty: number;
  availableQty: number;
  updatedAt: string;
  item: {
    id: string;
    name: string;
    sku: string;
    uom: string;
  };
  location: {
    id: string;
    code: string;
    name: string;
  };
  batch: {
    id: string;
    code: string;
  };
}
