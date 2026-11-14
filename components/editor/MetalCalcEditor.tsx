"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { WorkspaceCanvas } from "@/components/editor/WorkspaceCanvas";
import { BottomStatusBar } from "@/components/layout/BottomStatusBar";
import { TopToolbar } from "@/components/layout/TopToolbar";
import { LeftSidebar } from "@/components/panels/LeftSidebar";
import { RightInspector } from "@/components/panels/RightInspector";
import { useProjectStore } from "@/store/useProjectStore";
import { useWorkspaceUiStore } from "@/store/useWorkspaceUiStore";

export function MetalCalcEditor() {
  const hydrateFromStorage = useProjectStore((s) => s.hydrateFromStorage);
  const leftPanelOpen = useWorkspaceUiStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useWorkspaceUiStore((s) => s.rightPanelOpen);
  const leftDrawerOpen = useWorkspaceUiStore((s) => s.leftDrawerOpen);
  const rightDrawerOpen = useWorkspaceUiStore((s) => s.rightDrawerOpen);
  const closeDrawers = useWorkspaceUiStore((s) => s.closeDrawers);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  return (
    <div className="flex h-screen h-[100dvh] w-screen flex-col overflow-hidden bg-[var(--mc-bg-app)] text-[var(--mc-text)]">
      <TopToolbar />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {(leftDrawerOpen || rightDrawerOpen) && (
          <button
            type="button"
            aria-label="Закрыть боковую панель"
            onClick={closeDrawers}
            className="absolute inset-0 z-20 bg-black/50 backdrop-blur-[1px] lg:hidden"
          />
        )}

        <div
          className={`absolute inset-y-0 left-0 z-30 flex w-[min(19rem,86vw)] shrink-0 flex-col border-r border-[var(--mc-border)] bg-[var(--mc-bg-panel)] shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:w-64 lg:translate-x-0 lg:shadow-none lg:transition-none xl:w-72 ${
            leftDrawerOpen
              ? "translate-x-0"
              : "-translate-x-full pointer-events-none lg:pointer-events-auto"
          } ${leftPanelOpen ? "lg:flex" : "lg:hidden"}`}
        >
          <div className="flex items-center justify-between border-b border-[var(--mc-border)] px-3 py-2 lg:hidden">
            <span className="text-xs font-semibold text-[var(--mc-text)]">
              Инструменты и профили
            </span>
            <button
              type="button"
              onClick={closeDrawers}
              className="rounded p-1.5 text-[var(--mc-text-muted)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
              aria-label="Закрыть панель инструментов"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <LeftSidebar />
          </div>
        </div>

        <WorkspaceCanvas />

        <div
          className={`absolute inset-y-0 right-0 z-30 flex w-[min(21rem,88vw)] shrink-0 flex-col border-l border-[var(--mc-border)] bg-[var(--mc-bg-panel)] shadow-2xl transition-transform duration-200 lg:static lg:z-auto lg:w-72 lg:translate-x-0 lg:shadow-none lg:transition-none xl:w-80 ${
            rightDrawerOpen
              ? "translate-x-0"
              : "translate-x-full pointer-events-none lg:pointer-events-auto"
          } ${rightPanelOpen ? "lg:flex" : "lg:hidden"}`}
        >
          <div className="flex items-center justify-between border-b border-[var(--mc-border)] px-3 py-2 lg:hidden">
            <span className="text-xs font-semibold text-[var(--mc-text)]">
              Свойства и смета
            </span>
            <button
              type="button"
              onClick={closeDrawers}
              className="rounded p-1.5 text-[var(--mc-text-muted)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
              aria-label="Закрыть инспектор"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <RightInspector />
          </div>
        </div>
      </div>
      <BottomStatusBar />
    </div>
  );
}
