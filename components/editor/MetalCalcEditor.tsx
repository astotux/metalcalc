"use client";

import { useEffect } from "react";
import { WorkspaceCanvas } from "@/components/editor/WorkspaceCanvas";
import { BottomStatusBar } from "@/components/layout/BottomStatusBar";
import { TopToolbar } from "@/components/layout/TopToolbar";
import { LeftSidebar } from "@/components/panels/LeftSidebar";
import { RightInspector } from "@/components/panels/RightInspector";
import { useProjectStore } from "@/store/useProjectStore";

export function MetalCalcEditor() {
  const hydrateFromStorage = useProjectStore((s) => s.hydrateFromStorage);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#141619] text-[#e6e8ec]">
      <TopToolbar />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <LeftSidebar />
        <WorkspaceCanvas />
        <RightInspector />
      </div>
      <BottomStatusBar />
    </div>
  );
}
