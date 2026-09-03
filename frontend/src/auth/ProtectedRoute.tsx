"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";

/** Matches the AppShell frame so the swap into real content doesn't jump. */
function AuthPending() {
  return (
    <div className="flex h-screen items-center justify-center bg-canvas">
      <span className="sr-only">Checking your session…</span>
    </div>
  );
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const router = useRouter();

  useEffect(() => {
    // Only decide once the stored session has actually been read. The previous
    // version checked a `mounted` flag that was still false inside the very
    // effect that set it, so the redirect always ran a render late — which is
    // what let the shell paint before bouncing to /login.
    if (hasHydrated && !isAuthenticated) {
      // replace, not push: otherwise the protected URL stays in history and
      // Back walks straight back into the same bounce.
      router.replace("/login");
    }
  }, [hasHydrated, isAuthenticated, router]);

  // Identical on the server and on the first client render, so there's no
  // hydration mismatch — and never `null`, so there's no blank frame.
  if (!hasHydrated || !isAuthenticated) {
    return <AuthPending />;
  }

  return <>{children}</>;
}
