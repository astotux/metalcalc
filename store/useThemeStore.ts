"use client";

import { create } from "zustand";

export type AppTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "metalcalc_theme_v1";

export interface CanvasThemePalette {
  canvasBg: string;
  canvasBg3d: string;
  gridMinor: string;
  gridMajor: string;
  gridMinor3d: string;
  gridMajor3d: string;
  axisX: string;
  axisY: string;
  axisZ: string;
  axisXText: string;
  axisYText: string;
  axisZText: string;
  originDot: string;
  selectionHighlight: string;
  beamFallback: string;
  beamCenterline: string;
  badgeBg: string;
  badgeBorder: string;
  badgeSelectedBorder: string;
  badgeText: string;
  jointFill: string;
  jointSelectedFill: string;
  jointStroke: string;
  previewStroke: string;
  previewFill: string;
  previewText: string;
  marqueeFill: string;
  gridText: string;
}

export const CANVAS_PALETTES: Record<AppTheme, CanvasThemePalette> = {
  dark: {
    canvasBg: "#080a0e",
    canvasBg3d: "#0b0d12",
    gridMinor: "#141821",
    gridMajor: "#232936",
    gridMinor3d: "#181d27",
    gridMajor3d: "#2b3242",
    axisX: "#cb5843",
    axisY: "#34d399",
    axisZ: "#60a5fa",
    axisXText: "#f09a86",
    axisYText: "#6ee7b7",
    axisZText: "#93c5fd",
    originDot: "#f3f4f6",
    selectionHighlight: "#f3f4f6",
    beamFallback: "#d97b68",
    beamCenterline: "#12151c",
    badgeBg: "#12151c",
    badgeBorder: "#363e4f",
    badgeSelectedBorder: "#cb5843",
    badgeText: "#f3f4f6",
    jointFill: "#f59e0b",
    jointSelectedFill: "#ffffff",
    jointStroke: "#080a0e",
    previewStroke: "#cb5843",
    previewFill: "#b54834",
    previewText: "#ffffff",
    marqueeFill: "rgba(203, 88, 67, 0.16)",
    gridText: "#949eb0",
  },
  light: {
    canvasBg: "#fafbfc",
    canvasBg3d: "#f8f9fb",
    gridMinor: "#edf0f4",
    gridMajor: "#d7dde6",
    gridMinor3d: "#e7ebf1",
    gridMajor3d: "#cbd2de",
    axisX: "#b54834",
    axisY: "#15803d",
    axisZ: "#2563eb",
    axisXText: "#a33b28",
    axisYText: "#15803d",
    axisZText: "#1d4ed8",
    originDot: "#a33b28",
    selectionHighlight: "#a33b28",
    beamFallback: "#b54834",
    beamCenterline: "#374151",
    badgeBg: "#ffffff",
    badgeBorder: "#c4cbd6",
    badgeSelectedBorder: "#a33b28",
    badgeText: "#111827",
    jointFill: "#d97706",
    jointSelectedFill: "#a33b28",
    jointStroke: "#ffffff",
    previewStroke: "#a33b28",
    previewFill: "#a33b28",
    previewText: "#ffffff",
    marqueeFill: "rgba(163, 59, 40, 0.12)",
    gridText: "#525d70",
  },
};

interface ThemeStoreState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
  hydrateTheme: () => void;
}

export const useThemeStore = create<ThemeStoreState>((set, get) => ({
  theme: "dark",

  setTheme: (theme) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // ignore storage errors
      }
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
    set({ theme });
  },

  toggleTheme: () => {
    const next: AppTheme = get().theme === "dark" ? "light" : "dark";
    get().setTheme(next);
  },

  hydrateTheme: () => {
    if (typeof window === "undefined") return;
    let stored: AppTheme = "dark";
    try {
      const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (raw === "light" || raw === "dark") {
        stored = raw;
      }
    } catch {
      stored = "dark";
    }
    document.documentElement.dataset.theme = stored;
    document.documentElement.classList.toggle("dark", stored === "dark");
    set({ theme: stored });
  },
}));
