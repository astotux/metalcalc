"use client";

import { create } from "zustand";
import type { AuthUser, OAuthProvidersStatus } from "@/types";

interface AuthState {
  user: AuthUser | null;
  oauthProviders: OAuthProvidersStatus;
  loading: boolean;
  initialized: boolean;
  hydrateAuth: (force?: boolean) => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
}

let inFlightHydration: Promise<void> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  oauthProviders: { yandex: false, vk: false },
  loading: false,
  initialized: false,

  hydrateAuth: async (force = false) => {
    if (!force && get().initialized) return;
    if (inFlightHydration && !force) {
      await inFlightHydration;
      return;
    }

    set({ loading: true });
    inFlightHydration = (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        if (!res.ok) {
          set({ loading: false, initialized: true });
          return;
        }
        const data = (await res.json()) as {
          user: AuthUser | null;
          oauthProviders?: OAuthProvidersStatus;
        };
        set({
          user: data.user ?? null,
          oauthProviders: data.oauthProviders ?? { yandex: false, vk: false },
          loading: false,
          initialized: true,
        });
      } catch {
        set({ loading: false, initialized: true });
      } finally {
        inFlightHydration = null;
      }
    })();

    await inFlightHydration;
  },

  setUser: (user) => set({ user, initialized: true }),

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      set({ user: null, initialized: true });
    }
  },
}));
