import { Role } from "@/types/api";

export const PERMISSIONS = {
  // Inventory
  VIEW_INVENTORY: ["ADMIN", "OPERATIONS", "SALES"],
  ADJUST_INVENTORY: ["ADMIN", "OPERATIONS"],
  MANAGE_ITEMS: ["ADMIN", "OPERATIONS"],

  // Work Orders
  VIEW_WORK_ORDERS: ["ADMIN", "OPERATIONS", "SALES"],
  CREATE_WORK_ORDER: ["ADMIN"],
  UPDATE_WORK_ORDER_STATUS: ["ADMIN", "OPERATIONS"],

  // Transfers
  VIEW_TRANSFERS: ["ADMIN", "OPERATIONS", "SALES"],
  MANAGE_TRANSFERS: ["ADMIN", "OPERATIONS"],

  // Customer Orders
  VIEW_ORDERS: ["ADMIN", "OPERATIONS", "SALES"],
  CREATE_ORDER: ["ADMIN", "SALES"],
  CANCEL_ORDER: ["ADMIN", "SALES"],

  // Dashboard (if any)
  VIEW_DASHBOARD: ["ADMIN", "OPERATIONS", "SALES"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}
