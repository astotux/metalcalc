"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Columns2, Maximize2, Square } from "lucide-react";
import {
  OrthogonalViewport2D,
  type OrthogonalViewportHandle,
} from "@/features/drawing/OrthogonalViewport2D";
import type { OrthoPlane } from "@/lib/geometry/snapping";
import { useProjectStore } from "@/store/useProjectStore";

type LayoutMode2D = "three" | "single";

export default function KonvaCanvas2D() {
  const project = useProjectStore((s) => s.project);
  const selectedElementIds = useProjectStore((s) => s.selectedElementIds);

  const setActiveTool = useProjectStore((s) => s.setActiveTool);
  const selectMultipleElements = useProjectStore((s) => s.selectMultipleElements);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const deleteElements = useProjectStore((s) => s.deleteElements);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  const [layoutMode, setLayoutMode] = useState<LayoutMode2D>("three");
  const [focusedPlane, setFocusedPlane] = useState<OrthoPlane>("xy");

  const xyRef = useRef<OrthogonalViewportHandle>(null);
  const xzRef = useRef<OrthogonalViewportHandle>(null);
  const yzRef = useRef<OrthogonalViewportHandle>(null);

  const getViewportRef = useCallback((plane: OrthoPlane) => {
    if (plane === "xz") return xzRef.current;
    if (plane === "yz") return yzRef.current;
    return xyRef.current;
  }, []);

  const cancelAllDrafts = useCallback(() => {
    xyRef.current?.cancelDraft();
    xzRef.current?.cancelDraft();
    yzRef.current?.cancelDraft();
  }, []);

  const fitAllViewports = useCallback(() => {
    xyRef.current?.fitToScreen();
    xzRef.current?.fitToScreen();
    yzRef.current?.fitToScreen();
  }, []);

  // Сбрасываем незавершённые черновые построения при переключении инструмента
  useEffect(() => {
    const unsubscribe = useProjectStore.subscribe((state, prevState) => {
      if (state.activeTool !== prevState.activeTool) {
        cancelAllDrafts();
      }
    });
    return unsubscribe;
  }, [cancelAllDrafts]);

  // Единый обработчик горячих клавиш для всего 2D-режима (чтобы не дублироваться в 3 окнах)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);
      if (isInput) return;

      const key = event.key.toLowerCase();

      if ((event.ctrlKey || event.metaKey) && key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }
      if (
        ((event.ctrlKey || event.metaKey) && key === "y") ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && key === "z")
      ) {
        event.preventDefault();
        redo();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && key === "a") {
        event.preventDefault();
        selectMultipleElements(project.elements.map((el) => el.id), false);
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedElementIds.length > 0) {
          event.preventDefault();
          deleteElements(selectedElementIds);
        }
        return;
      }

      if (event.key === "Enter") {
        getViewportRef(focusedPlane)?.finishPolyline();
        return;
      }

      if (event.key === "Escape") {
        cancelAllDrafts();
        clearSelection();
        setActiveTool("select");
        return;
      }

      if (key === "f") {
        fitAllViewports();
        return;
      }

      if (key === "v" || key === "1") setActiveTool("select");
      else if (key === "l" || key === "2") setActiveTool("line");
      else if (key === "r" || key === "3") setActiveTool("rectangle");
      else if (key === "p" || key === "4") setActiveTool("polyline");
      else if (key === "m" || key === "5") setActiveTool("move");
      else if (key === "c" || key === "6") setActiveTool("copy");
      else if (key === "e" || key === "7") setActiveTool("resize");
      else if (key === "x" || key === "8") setActiveTool("delete");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    cancelAllDrafts,
    clearSelection,
    deleteElements,
    fitAllViewports,
    focusedPlane,
    getViewportRef,
    project.elements,
    redo,
    selectedElementIds,
    selectMultipleElements,
    setActiveTool,
    undo,
  ]);

  return (
    <div
      data-testid="canvas-2d-stage"
      className="flex h-full w-full flex-col overflow-hidden bg-[var(--mc-bg-canvas)]"
    >
      {/* Панель переключения 3-х ортогональных проекций */}
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-[var(--mc-border)] bg-[var(--mc-bg-panel)] px-3 text-xs">
        <div className="flex min-w-0 items-center gap-2 text-[var(--mc-text-muted)]">
          <span className="font-semibold text-[var(--mc-text)]">
            {layoutMode === "three"
              ? "3 проекции (XY · XZ · YZ)"
              : "1 проекция (XY сверху)"}
          </span>
          <span className="hidden truncate text-[11px] text-[var(--mc-text-muted)] lg:inline">
            · Размеры на стержнях показывают реальную длину по всем 3 осям (X, Y, Z)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={fitAllViewports}
            title="Вписать конструкцию во все активные виды (F)"
            className="inline-flex h-6.5 items-center gap-1 rounded border border-[var(--mc-border)] bg-[var(--mc-bg-elevated)] px-2 text-[11px] font-medium text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
          >
            <Maximize2 className="h-3 w-3" />
            Вписать все
          </button>

          <div className="inline-flex rounded border border-[var(--mc-border)] bg-[var(--mc-bg-input)] p-0.5">
            <button
              type="button"
              onClick={() => setLayoutMode("three")}
              data-testid="btn-2d-layout-three"
              className={`inline-flex h-5.5 items-center gap-1 rounded px-2 text-[11px] font-medium transition ${
                layoutMode === "three"
                  ? "bg-[var(--mc-brand)] text-[var(--mc-brand-text)]"
                  : "text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
              }`}
            >
              <Columns2 className="h-3 w-3" />
              3 вида
            </button>
            <button
              type="button"
              onClick={() => {
                setLayoutMode("single");
                setFocusedPlane("xy");
              }}
              data-testid="btn-2d-layout-single"
              className={`inline-flex h-5.5 items-center gap-1 rounded px-2 text-[11px] font-medium transition ${
                layoutMode === "single"
                  ? "bg-[var(--mc-brand)] text-[var(--mc-brand-text)]"
                  : "text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]"
              }`}
            >
              <Square className="h-3 w-3" />
              1 вид (XY)
            </button>
          </div>
        </div>
      </div>

      {/* Рабочая область: на >= lg слева главный вид XY и справа стеком XZ/YZ; на планшетах (< lg) XY сверху, XZ и YZ рядом снизу */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div
          className={`min-h-0 min-w-0 transition-all ${
            layoutMode === "three"
              ? "h-[56%] w-full border-b border-[var(--mc-border)] lg:h-full lg:w-[62%] lg:border-b-0 lg:border-r"
              : "h-full w-full"
          }`}
        >
          <OrthogonalViewport2D
            ref={xyRef}
            plane="xy"
            title="Главный вид · Сверху (XY)"
            subtitle="План X/Y"
            isPrimary
            isFocused={focusedPlane === "xy"}
            onFocus={() => setFocusedPlane("xy")}
          />
        </div>

        {layoutMode === "three" && (
          <div className="grid h-[44%] w-full min-h-0 min-w-0 grid-cols-2 lg:flex lg:h-full lg:w-[38%] lg:flex-col">
            <div className="min-h-0 min-w-0 border-r border-[var(--mc-border)] lg:flex-1 lg:border-r-0 lg:border-b">
              <OrthogonalViewport2D
                ref={xzRef}
                plane="xz"
                title="Спереди (XZ)"
                subtitle="Ширина X · Высота Z"
                isFocused={focusedPlane === "xz"}
                onFocus={() => setFocusedPlane("xz")}
              />
            </div>
            <div className="min-h-0 min-w-0 lg:flex-1">
              <OrthogonalViewport2D
                ref={yzRef}
                plane="yz"
                title="Сбоку (YZ)"
                subtitle="Глубина Y · Высота Z"
                isFocused={focusedPlane === "yz"}
                onFocus={() => setFocusedPlane("yz")}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
