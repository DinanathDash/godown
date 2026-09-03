"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { hasPermission, Permission } from "./permissions";

interface RoleGateProps {
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({
  permission,
  children,
  fallback = null,
}: RoleGateProps) {
  const user = useAuthStore((state) => state.user);

  if (!user || !hasPermission(user.role, permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
