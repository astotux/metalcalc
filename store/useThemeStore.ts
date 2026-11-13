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
    canvasBg: "#0e0c10",
    canvasBg3d: "#0f0d11",
    gridMinor: "#1b171e",
    gridMajor: "#2c242f",
    gridMinor3d: "#211c24",
    gridMajor3d: "#382c36",
    axisX: "#9f4636",
    axisY: "#4e8a64",
    axisZ: "#6289c4",
    axisXText: "#df8d7c",
    axisYText: "#80c496",
    axisZText: "#93b9f2",
    originDot: "#f1dcc9",
    selectionHighlight: "#f5ede6",
    beamFallback: "#c87d6d",
    beamCenterline: "#161218",
    badgeBg: "#18151a",
    badgeBorder: "#42313a",
    badgeSelectedBorder: "#9f4636",
    badgeText: "#f5ede6",
    jointFill: "#eab364",
    jointSelectedFill: "#ffffff",
    jointStroke: "#0e0c10",
    previewStroke: "#9f4636",
    previewFill: "#6c2d2c",
    previewText: "#ffffff",
    marqueeFill: "rgba(159, 70, 54, 0.16)",
    gridText: "#b29e93",
  },
  light: {
    canvasBg: "#f8f8f9",
    canvasBg3d: "#fafafa",
    gridMinor: "#eceaef",
    gridMajor: "#d8d2d9",
    gridMinor3d: "#e6e3e8",
    gridMajor3d: "#ccc4cd",
    axisX: "#9f4636",
    axisY: "#346e48",
    axisZ: "#355d8f",
    axisXText: "#9f4636",
    axisYText: "#285d3a",
    axisZText: "#284c78",
    originDot: "#6c2d2c",
    selectionHighlight: "#6c2d2c",
    beamFallback: "#9f4636",
    beamCenterline: "#42313a",
    badgeBg: "#ffffff",
    badgeBorder: "#d5ccd2",
    badgeSelectedBorder: "#6c2d2c",
    badgeText: "#291e24",
    jointFill: "#c9792a",
    jointSelectedFill: "#6c2d2c",
    jointStroke: "#ffffff",
    previewStroke: "#6c2d2c",
    previewFill: "#6c2d2c",
    previewText: "#ffffff",
    marqueeFill: "rgba(108, 45, 44, 0.12)",
    gridText: "#6c5862",
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
