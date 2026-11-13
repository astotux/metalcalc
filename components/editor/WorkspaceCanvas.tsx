"use client";

import dynamic from "next/dynamic";
import { useProjectStore } from "@/store/useProjectStore";

const KonvaCanvas2D = dynamic(() => import("@/features/drawing/KonvaCanvas2D"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center bg-[var(--mc-bg-canvas)] text-xs text-[var(--mc-text-muted)]">
      Загрузка 2D-редактора...
    </div>
  ),
});

const SceneCanvas3D = dynamic(() => import("@/features/visualization/SceneCanvas3D"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center bg-[var(--mc-bg-canvas)] text-xs text-[var(--mc-text-muted)]">
      Загрузка 3D-сцены...
    </div>
  ),
});

export function WorkspaceCanvas() {
  const viewMode = useProjectStore((s) => s.project.displaySettings.viewMode);

  if (viewMode === "2d") {
    return <KonvaCanvas2D />;
  }

  return <SceneCanvas3D />;
}
