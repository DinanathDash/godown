export type Role = "ADMIN" | "ACCOUNTS" | "SALES" | "WAREHOUSE";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
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

export type CustomerStatus = "ACTIVE" | "LEAD" | "INACTIVE";
export type CustomerType = "RETAIL" | "WHOLESALE" | "DISTRIBUTOR";

export interface Customer {
  id: string;
  name: string;
  businessName: string | null;
  email: string | null;
  mobile: string;
  address: string | null;
  type: CustomerType;
  status: CustomerStatus;
  creditLimit: string;
  balance: string;
  gstin: string | null;
  followUpDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: string;
  unitPrice: string;
  currentStock: number;
  minStockAlert: number;
  location: string | null;
  status: "ACTIVE" | "DISCONTINUED";
  createdAt: string;
  updatedAt: string;
}

export interface ChallanItem {
  id: string;
  challanId: string;
  productId: string;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
  productName: string | null;
  sku: string | null;
}

export interface Challan {
  id: string;
  challanNumber: string | null;
  customerId: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED";
  totalAmount: string;
  notes: string | null;
  createdById: string;
  confirmedById: string | null;
  cancelledById: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  customerSnapshot?: {
    name: string;
    businessName: string | null;
    email: string | null;
    mobile: string | null;
    gstNumber: string | null;
    address: string | null;
  };
  items: ChallanItem[];
  _count?: {
    items: number;
  };
}

export interface StockMovement {
  id: string;
  productId: string;
  type: "IN" | "OUT";
  quantity: number;
  balanceAfter: number;
  reason: string;
  referenceId: string | null;
  referenceType: string | null;
  createdById: string;
  createdAt: string;
  createdBy: { name: string; email: string };
}
