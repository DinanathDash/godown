"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
  }, [initialize]);

  if (!isMounted) {
    return null; // Prevents hydration mismatch
  }

  return <>{children}</>;
}
