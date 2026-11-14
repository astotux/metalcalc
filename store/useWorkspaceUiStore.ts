"use client";

import { create } from "zustand";

interface WorkspaceUiState {
  // Состояние панелей на широких экранах (>= lg: ноутбуки и десктопы)
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  // Состояние выдвижных шторк на планшетах (< lg)
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;
  toggleLeftPanel: () => void;
  toggleRightPanel: () => void;
  toggleLeftDrawer: () => void;
  toggleRightDrawer: () => void;
  setLeftDrawerOpen: (open: boolean) => void;
  setRightDrawerOpen: (open: boolean) => void;
  closeDrawers: () => void;
}

export const useWorkspaceUiStore = create<WorkspaceUiState>((set) => ({
  leftPanelOpen: true,
  rightPanelOpen: true,
  leftDrawerOpen: false,
  rightDrawerOpen: false,
  toggleLeftPanel: () => set((s) => ({ leftPanelOpen: !s.leftPanelOpen })),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  toggleLeftDrawer: () =>
    set((s) => ({
      leftDrawerOpen: !s.leftDrawerOpen,
      rightDrawerOpen: false,
    })),
  toggleRightDrawer: () =>
    set((s) => ({
      rightDrawerOpen: !s.rightDrawerOpen,
      leftDrawerOpen: false,
    })),
  setLeftDrawerOpen: (open) => set({ leftDrawerOpen: open }),
  setRightDrawerOpen: (open) => set({ rightDrawerOpen: open }),
  closeDrawers: () => set({ leftDrawerOpen: false, rightDrawerOpen: false }),
}));
