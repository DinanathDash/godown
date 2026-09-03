import { create } from "zustand";
import { User } from "@/types/api";

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  /**
   * False until localStorage has been read on the client.
   *
   * Nothing may decide "logged out" before this flips, otherwise every reload
   * bounces a signed-in user to /login: the store starts empty, so the first
   * render always looks unauthenticated even when a valid token exists.
   */
  hasHydrated: boolean;
  login: (user: User, token: string) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  hasHydrated: false,

  login: (user, token) => {
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("token", token);
    set({ user, token, isAuthenticated: true, hasHydrated: true });
  },

  logout: () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    set({ user: null, token: null, isAuthenticated: false, hasHydrated: true });
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login";
  },

  hydrate: () => {
    try {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token");
      if (storedUser && storedToken) {
        set({
          user: JSON.parse(storedUser),
          token: storedToken,
          isAuthenticated: true,
          hasHydrated: true,
        });
        return;
      }
    } catch {
      // Corrupt stored value — fall through and treat as signed out.
    }
    set({ user: null, token: null, isAuthenticated: false, hasHydrated: true });
  },
}));
