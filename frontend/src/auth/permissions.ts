import { Role } from "@/types/api";

export const PERMISSIONS = {
  // Customers
  CREATE_CUSTOMER: ["ADMIN", "SALES"],
  VIEW_CUSTOMER: ["ADMIN", "SALES", "ACCOUNTS"],
  UPDATE_CUSTOMER: ["ADMIN", "SALES"],
  DELETE_CUSTOMER: ["ADMIN"],
  ADD_CUSTOMER_NOTE: ["ADMIN", "SALES"],

  // Products
  CREATE_PRODUCT: ["ADMIN", "WAREHOUSE"],
  VIEW_PRODUCT: ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"],
  UPDATE_PRODUCT: ["ADMIN", "WAREHOUSE"],
  DELETE_PRODUCT: ["ADMIN"],
  ADJUST_STOCK: ["ADMIN", "WAREHOUSE"],

  // Challans
  CREATE_CHALLAN: ["ADMIN", "SALES"],
  VIEW_CHALLAN: ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"],
  CONFIRM_CHALLAN: ["ADMIN", "SALES", "WAREHOUSE"],
  CANCEL_CHALLAN: ["ADMIN"],

  // Dashboard
  VIEW_DASHBOARD: ["ADMIN", "SALES", "WAREHOUSE", "ACCOUNTS"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
