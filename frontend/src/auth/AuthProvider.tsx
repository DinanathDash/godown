"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";

/**
 * Reads the stored session once on mount.
 *
 * It deliberately renders children immediately rather than blanking the tree
 * while it waits. Returning null here hid every page — including /login, which
 * needs no session at all — behind an empty frame on each load. Gating belongs
 * in ProtectedRoute, which is the only part that actually depends on the answer.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return <>{children}</>;
}
