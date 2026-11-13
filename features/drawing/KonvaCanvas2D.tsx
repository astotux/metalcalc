"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import { RotateCcw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { getElementMidpoint, roundMm } from "@/lib/geometry/elements";
import {
  getAllIntersections2D,
  getSnapPoint,
  isElementInSelectionRect,
  type SnapResult,
} from "@/lib/geometry/snapping";
import { useProjectStore } from "@/store/useProjectStore";
import type { ConstructionElement, Point2D } from "@/types";

const BASE_PX_PER_MM = 0.4;

type DragAction =
  | { kind: "pan"; startClient: Point2D; startPanPx: Point2D }
  | { kind: "marquee"; startMm: Point2D; currentMm: Point2D; additive: boolean }
  | {
      kind: "move" | "copy";
      targetIds: string[];
      anchorMm: Point2D;
      deltaMm: Point2D;
    }
  | {
      kind: "resize_handle";
      elementId: string;
      endpoint: "start" | "end";
      otherPointMm: Point2D;
      currentPointMm: Point2D;
    };

const SNAP_LABELS: Record<SnapResult["snapType"], string> = {
  endpoint: "Конец линии",
  intersection: "Пересечение",
  angle: "Угол",
  grid: "Сетка",
  none: "Свободно",
};

export default function KonvaCanvas2D() {
  const project = useProjectStore((s) => s.project);
  const activeTool = useProjectStore((s) => s.activeTool);
  const activeProfileId = useProjectStore((s) => s.activeProfileId);
  const selectedElementIds = useProjectStore((s) => s.selectedElementIds);

  const setActiveTool = useProjectStore((s) => s.setActiveTool);
  const selectElement = useProjectStore((s) => s.selectElement);
  const selectMultipleElements = useProjectStore((s) => s.selectMultipleElements);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const addElement = useProjectStore((s) => s.addElement);
  const addElementsBatch = useProjectStore((s) => s.addElementsBatch);
  const moveElements = useProjectStore((s) => s.moveElements);
  const copyElements = useProjectStore((s) => s.copyElements);
  const setElementEndpoints = useProjectStore((s) => s.setElementEndpoints);
  const deleteElements = useProjectStore((s) => s.deleteElements);
  const setZoomPercent = useProjectStore((s) => s.setZoomPercent);
  const updateGridSettings = useProjectStore((s) => s.updateGridSettings);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 900, height: 600 });
  const [panPx, setPanPx] = useState<Point2D>({ x: 180, y: 160 });
  const [spacePressed, setSpacePressed] = useState(false);

  // Состояние текущего черчения
  const [drawStartMm, setDrawStartMm] = useState<Point2D | null>(null);
  const [polyPointsMm, setPolyPointsMm] = useState<Point2D[]>([]);
  const [typedLength, setTypedLength] = useState("");
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [snapInfo, setSnapInfo] = useState<SnapResult>({
    point: { x: 0, y: 0 },
    snapType: "none",
  });
  const [dragAction, setDragAction] = useState<DragAction | null>(null);

  const { zoomPercent } = project.displaySettings;
  const { majorStepMm, minorStepMm, showGrid, showAxes, showDimensions, snapEnabled } =
    project.gridSettings;
  const scale = BASE_PX_PER_MM * (zoomPercent / 100);

  const profileMap = useMemo(
    () => new Map(project.profiles.map((p) => [p.id, p])),
    [project.profiles]
  );
  const activeProfile = profileMap.get(activeProfileId) ?? project.profiles[0];

  const intersections = useMemo(
    () =>
      project.gridSettings.snapToIntersections
        ? getAllIntersections2D(project.elements)
        : [],
    [project.elements, project.gridSettings.snapToIntersections]
  );

  // Отслеживаем размер рабочей области через ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setStageSize({
          width: Math.max(200, Math.floor(entry.contentRect.width)),
          height: Math.max(200, Math.floor(entry.contentRect.height)),
        });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const worldToScreen = useCallback(
    (p: Point2D): Point2D => ({
      x: panPx.x + p.x * scale,
      y: panPx.y + p.y * scale,
    }),
    [panPx, scale]
  );

  const screenToWorld = useCallback(
    (screen: Point2D): Point2D => ({
      x: (screen.x - panPx.x) / scale,
      y: (screen.y - panPx.y) / scale,
    }),
    [panPx, scale]
  );

  const commitPolyline = useCallback(
    (points: Point2D[]) => {
      if (points.length < 2) {
        setPolyPointsMm([]);
        return;
      }
      const segments = [];
      for (let i = 0; i < points.length - 1; i += 1) {
        const a = points[i];
        const b = points[i + 1];
        if (Math.hypot(b.x - a.x, b.y - a.y) >= 1) {
          segments.push({
            start: { x: a.x, y: a.y, z: 0 },
            end: { x: b.x, y: b.y, z: 0 },
            profileId: activeProfileId,
          });
        }
      }
      if (segments.length > 0) {
        addElementsBatch(segments);
      }
      setPolyPointsMm([]);
      setTypedLength("");
    },
    [activeProfileId, addElementsBatch]
  );

  // Горячие клавиши CAD-редактора
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTypingInInput =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";

      if (isTypingInInput) return;

      if (e.code === "Space") {
        e.preventDefault();
        setSpacePressed(true);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElementIds.length > 0) {
          e.preventDefault();
          deleteElements(selectedElementIds);
        }
        return;
      }

      if (e.key === "Escape") {
        if (drawStartMm || polyPointsMm.length > 0 || dragAction) {
          setDrawStartMm(null);
          setPolyPointsMm([]);
          setDragAction(null);
          setTypedLength("");
        } else if (selectedElementIds.length > 0) {
          clearSelection();
        } else if (activeTool !== "select") {
          setActiveTool("select");
        }
        return;
      }

      // Ввод точной длины при рисовании линии или ломаной
      const anchor =
        activeTool === "line"
          ? drawStartMm
          : activeTool === "polyline" && polyPointsMm.length > 0
            ? polyPointsMm[polyPointsMm.length - 1]
            : null;

      if (anchor) {
        if (/^[0-9.]$/.test(e.key)) {
          setTypedLength((prev) => prev + e.key);
          return;
        }
        if (e.key === "Backspace" && typedLength.length > 0) {
          setTypedLength((prev) => prev.slice(0, -1));
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          const len = Number(typedLength);
          if (Number.isFinite(len) && len >= 1) {
            const dx = snapInfo.point.x - anchor.x;
            const dy = snapInfo.point.y - anchor.y;
            const dist = Math.hypot(dx, dy);
            const dirX = dist > 1e-3 ? dx / dist : 1;
            const dirY = dist > 1e-3 ? dy / dist : 0;
            const targetPoint: Point2D = {
              x: roundMm(anchor.x + dirX * len),
              y: roundMm(anchor.y + dirY * len),
            };
            if (activeTool === "line") {
              addElement(
                { x: anchor.x, y: anchor.y, z: 0 },
                { x: targetPoint.x, y: targetPoint.y, z: 0 },
                activeProfileId
              );
              setDrawStartMm(null);
              setTypedLength("");
            } else if (activeTool === "polyline") {
              setPolyPointsMm((prev) => [...prev, targetPoint]);
              setTypedLength("");
            }
            return;
          }
        }
      }

      if (e.key === "Enter" && activeTool === "polyline" && polyPointsMm.length >= 2) {
        e.preventDefault();
        commitPolyline(polyPointsMm);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpacePressed(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    activeProfileId,
    activeTool,
    addElement,
    clearSelection,
    commitPolyline,
    deleteElements,
    dragAction,
    drawStartMm,
    polyPointsMm,
    redo,
    selectedElementIds,
    setActiveTool,
    snapInfo.point,
    typedLength,
    undo,
  ]);

  // Масштабирование колёсиком мыши относительно курсора без изменения реальных размеров объектов
  const handleWheel = (e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    const factor = e.evt.deltaY < 0 ? 1.12 : 1 / 1.12;
    const nextZoom = Math.min(400, Math.max(10, Math.round(zoomPercent * factor)));
    const nextScale = BASE_PX_PER_MM * (nextZoom / 100);

    const worldAtCursor = screenToWorld(pointer);
    setPanPx({
      x: pointer.x - worldAtCursor.x * nextScale,
      y: pointer.y - worldAtCursor.y * nextScale,
    });
    setZoomPercent(nextZoom);
  };

  const fitToScreen = () => {
    if (project.elements.length === 0) {
      setZoomPercent(100);
      setPanPx({ x: stageSize.width / 3, y: stageSize.height / 2 });
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of project.elements) {
      minX = Math.min(minX, el.start.x, el.end.x);
      minY = Math.min(minY, el.start.y, el.end.y);
      maxX = Math.max(maxX, el.start.x, el.end.x);
      maxY = Math.max(maxY, el.start.y, el.end.y);
    }

    const widthMm = Math.max(200, maxX - minX);
    const heightMm = Math.max(200, maxY - minY);
    const padding = 100;
    const targetScale = Math.min(
      (stageSize.width - padding * 2) / widthMm,
      (stageSize.height - padding * 2) / heightMm
    );
    const nextZoom = Math.min(400, Math.max(10, Math.round((targetScale / BASE_PX_PER_MM) * 100)));
    const actualScale = BASE_PX_PER_MM * (nextZoom / 100);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    setZoomPercent(nextZoom);
    setPanPx({
      x: stageSize.width / 2 - centerX * actualScale,
      y: stageSize.height / 2 - centerY * actualScale,
    });
  };

  const getAnchorForTool = (): Point2D | null => {
    if (activeTool === "line" && drawStartMm) return drawStartMm;
    if (activeTool === "polyline" && polyPointsMm.length > 0) {
      return polyPointsMm[polyPointsMm.length - 1];
    }
    return null;
  };

  const computeSnap = (
    pointerScreen: Point2D,
    excludeIds?: Set<string>,
    customAnchor?: Point2D | null
  ): SnapResult => {
    const rawWorld = screenToWorld(pointerScreen);
    return getSnapPoint(rawWorld, project.elements, project.gridSettings, {
      anchorMm: customAnchor ?? getAnchorForTool(),
      snapRadiusMm: 16 / scale,
      excludeElementIds: excludeIds,
    });
  };

  const handleStageMouseDown = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    // Средняя кнопка, правая кнопка (если не завершаем ломаную), либо Space + ЛКМ -> панорамирование
    if (e.evt.button === 1 || (e.evt.button === 0 && spacePressed)) {
      setDragAction({
        kind: "pan",
        startClient: { x: e.evt.clientX, y: e.evt.clientY },
        startPanPx: { ...panPx },
      });
      return;
    }

    if (e.evt.button === 2) {
      if (activeTool === "polyline" && polyPointsMm.length >= 2) {
        commitPolyline(polyPointsMm);
        return;
      }
      setDragAction({
        kind: "pan",
        startClient: { x: e.evt.clientX, y: e.evt.clientY },
        startPanPx: { ...panPx },
      });
      return;
    }

    if (e.evt.button !== 0) return;

    const snap = computeSnap(pointer);
    setSnapInfo(snap);

    // Черчение линии
    if (activeTool === "line") {
      if (!drawStartMm) {
        setDrawStartMm(snap.point);
        setTypedLength("");
      } else {
        if (Math.hypot(snap.point.x - drawStartMm.x, snap.point.y - drawStartMm.y) >= 1) {
          addElement(
            { x: drawStartMm.x, y: drawStartMm.y, z: 0 },
            { x: snap.point.x, y: snap.point.y, z: 0 },
            activeProfileId
          );
        }
        setDrawStartMm(null);
        setTypedLength("");
      }
      return;
    }

    // Черчение прямоугольника (4 балки)
    if (activeTool === "rectangle") {
      if (!drawStartMm) {
        setDrawStartMm(snap.point);
      } else {
        const x1 = drawStartMm.x;
        const y1 = drawStartMm.y;
        const x2 = snap.point.x;
        const y2 = snap.point.y;
        if (Math.abs(x2 - x1) >= 1 && Math.abs(y2 - y1) >= 1) {
          addElementsBatch([
            { start: { x: x1, y: y1, z: 0 }, end: { x: x2, y: y1, z: 0 }, profileId: activeProfileId },
            { start: { x: x2, y: y1, z: 0 }, end: { x: x2, y: y2, z: 0 }, profileId: activeProfileId },
            { start: { x: x2, y: y2, z: 0 }, end: { x: x1, y: y2, z: 0 }, profileId: activeProfileId },
            { start: { x: x1, y: y2, z: 0 }, end: { x: x1, y: y1, z: 0 }, profileId: activeProfileId },
          ]);
        }
        setDrawStartMm(null);
      }
      return;
    }

    // Черчение ломаной
    if (activeTool === "polyline") {
      if (polyPointsMm.length >= 2) {
        const first = polyPointsMm[0];
        if (Math.hypot(snap.point.x - first.x, snap.point.y - first.y) < 12 / scale) {
          commitPolyline([...polyPointsMm, first]);
          return;
        }
      }
      setPolyPointsMm((prev) => [...prev, snap.point]);
      setTypedLength("");
      return;
    }

    // Клик по пустому полю в режиме выбора -> рамка выделения
    if (activeTool === "select" && e.target === stage) {
      const worldPt = screenToWorld(pointer);
      setDragAction({
        kind: "marquee",
        startMm: worldPt,
        currentMm: worldPt,
        additive: e.evt.shiftKey,
      });
    }
  };

  const handleStageMouseMove = (e: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;

    if (dragAction?.kind === "pan") {
      setPanPx({
        x: dragAction.startPanPx.x + (e.evt.clientX - dragAction.startClient.x),
        y: dragAction.startPanPx.y + (e.evt.clientY - dragAction.startClient.y),
      });
      return;
    }

    if (dragAction?.kind === "marquee") {
      setDragAction({ ...dragAction, currentMm: screenToWorld(pointer) });
      return;
    }

    if (dragAction?.kind === "move" || dragAction?.kind === "copy") {
      const snap = computeSnap(pointer, new Set(dragAction.targetIds), dragAction.anchorMm);
      setSnapInfo(snap);
      setDragAction({
        ...dragAction,
        deltaMm: {
          x: roundMm(snap.point.x - dragAction.anchorMm.x),
          y: roundMm(snap.point.y - dragAction.anchorMm.y),
        },
      });
      return;
    }

    if (dragAction?.kind === "resize_handle") {
      const snap = computeSnap(
        pointer,
        new Set([dragAction.elementId]),
        dragAction.otherPointMm
      );
      setSnapInfo(snap);
      setDragAction({ ...dragAction, currentPointMm: snap.point });
      return;
    }

    setSnapInfo(computeSnap(pointer));
  };

  const handleStageMouseUp = () => {
    if (!dragAction) return;

    if (dragAction.kind === "marquee") {
      const dist = Math.hypot(
        dragAction.currentMm.x - dragAction.startMm.x,
        dragAction.currentMm.y - dragAction.startMm.y
      );
      if (dist * scale < 4) {
        if (!dragAction.additive) clearSelection();
      } else {
        const rect = {
          x1: dragAction.startMm.x,
          y1: dragAction.startMm.y,
          x2: dragAction.currentMm.x,
          y2: dragAction.currentMm.y,
        };
        const hits = project.elements
          .filter((el) => isElementInSelectionRect(el, rect))
          .map((el) => el.id);
        selectMultipleElements(hits, dragAction.additive);
      }
    } else if (dragAction.kind === "move") {
      moveElements(dragAction.targetIds, {
        x: dragAction.deltaMm.x,
        y: dragAction.deltaMm.y,
        z: 0,
      });
    } else if (dragAction.kind === "copy") {
      if (Math.hypot(dragAction.deltaMm.x, dragAction.deltaMm.y) >= 1) {
        copyElements(dragAction.targetIds, {
          x: dragAction.deltaMm.x,
          y: dragAction.deltaMm.y,
          z: 0,
        });
      }
    } else if (dragAction.kind === "resize_handle") {
      const target = project.elements.find((el) => el.id === dragAction.elementId);
      if (target) {
        const newStart =
          dragAction.endpoint === "start"
            ? { ...dragAction.currentPointMm, z: target.start.z }
            : target.start;
        const newEnd =
          dragAction.endpoint === "end"
            ? { ...dragAction.currentPointMm, z: target.end.z }
            : target.end;
        if (Math.hypot(newEnd.x - newStart.x, newEnd.y - newStart.y) >= 1) {
          setElementEndpoints(target.id, newStart, newEnd);
        }
      }
    }

    setDragAction(null);
  };

  const handleElementMouseDown = (
    e: Konva.KonvaEventObject<MouseEvent>,
    element: ConstructionElement
  ) => {
    if (e.evt.button !== 0 || spacePressed) return;
    if (activeTool === "line" || activeTool === "rectangle" || activeTool === "polyline") {
      return;
    }

    e.cancelBubble = true;

    if (activeTool === "delete") {
      deleteElements([element.id]);
      return;
    }

    if (activeTool === "select" || activeTool === "resize") {
      selectElement(element.id, e.evt.shiftKey);
      return;
    }

    if (activeTool === "move" || activeTool === "copy") {
      const stage = e.target.getStage();
      const pointer = stage?.getPointerPosition();
      if (!pointer) return;

      const isAlreadySelected = selectedElementIds.includes(element.id);
      let targetIds = isAlreadySelected ? selectedElementIds : [element.id];
      if (!isAlreadySelected) {
        selectElement(element.id, false);
        const grp = element.groupId
          ? project.groups.find((g) => g.id === element.groupId)
          : null;
        if (grp) targetIds = grp.elementIds;
      }

      const snap = computeSnap(pointer);
      setDragAction({
        kind: activeTool,
        targetIds,
        anchorMm: snap.point,
        deltaMm: { x: 0, y: 0 },
      });
    }
  };

  const handleEndpointHandleMouseDown = (
    e: Konva.KonvaEventObject<MouseEvent>,
    element: ConstructionElement,
    endpoint: "start" | "end"
  ) => {
    if (e.evt.button !== 0 || spacePressed) return;
    e.cancelBubble = true;
    const otherPoint = endpoint === "start" ? element.end : element.start;
    const currentPoint = endpoint === "start" ? element.start : element.end;
    setDragAction({
      kind: "resize_handle",
      elementId: element.id,
      endpoint,
      otherPointMm: { x: otherPoint.x, y: otherPoint.y },
      currentPointMm: { x: currentPoint.x, y: currentPoint.y },
    });
  };

  // Расчёт линий сетки в видимой области
  const gridLines = useMemo(() => {
    if (!showGrid) return { minor: [] as number[][], major: [] as number[][] };

    const minX = -panPx.x / scale;
    const maxX = (stageSize.width - panPx.x) / scale;
    const minY = -panPx.y / scale;
    const maxY = (stageSize.height - panPx.y) / scale;

    const minor: number[][] = [];
    const major: number[][] = [];

    const drawMinor = minorStepMm * scale >= 7;
    const drawMajor = majorStepMm * scale >= 18;

    if (drawMinor) {
      const startX = Math.floor(minX / minorStepMm) * minorStepMm;
      for (let x = startX; x <= maxX; x += minorStepMm) {
        const sx = panPx.x + x * scale;
        minor.push([sx, 0, sx, stageSize.height]);
      }
      const startY = Math.floor(minY / minorStepMm) * minorStepMm;
      for (let y = startY; y <= maxY; y += minorStepMm) {
        const sy = panPx.y + y * scale;
        minor.push([0, sy, stageSize.width, sy]);
      }
    }

    if (drawMajor) {
      const startX = Math.floor(minX / majorStepMm) * majorStepMm;
      for (let x = startX; x <= maxX; x += majorStepMm) {
        const sx = panPx.x + x * scale;
        major.push([sx, 0, sx, stageSize.height]);
      }
      const startY = Math.floor(minY / majorStepMm) * majorStepMm;
      for (let y = startY; y <= maxY; y += majorStepMm) {
        const sy = panPx.y + y * scale;
        major.push([0, sy, stageSize.width, sy]);
      }
    }

    return { minor, major };
  }, [majorStepMm, minorStepMm, panPx.x, panPx.y, scale, showGrid, stageSize.height, stageSize.width]);

  // Список элементов с учётом живого превью перетаскивания/изменения размера
  const handleVisibleElements = useMemo(() => {
    if (activeTool === "resize" && hoveredElementId) {
      const el = project.elements.find((item) => item.id === hoveredElementId);
      return el ? [el] : [];
    }
    if (selectedElementIds.length === 1) {
      const el = project.elements.find((item) => item.id === selectedElementIds[0]);
      return el ? [el] : [];
    }
    return [];
  }, [activeTool, hoveredElementId, project.elements, selectedElementIds]);

  const activeAnchor = getAnchorForTool();

  return (
    <div
      ref={containerRef}
      onContextMenu={(e) => e.preventDefault()}
      className="relative flex-1 overflow-hidden bg-[#121417]"
    >
      {/* Верхняя плавающая панель 2D-вида и привязок */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded border border-[#2c313a] bg-[#181b20]/95 px-2.5 py-1 text-[11px] text-[#9aa2b1] shadow-md">
          <span className="font-medium text-[#e6e8ec]">2D Черчение (Konva)</span>
          <span className="text-[#4a5260]">|</span>
          <span className="tabular-nums text-[#e6e8ec]">
            X: {snapInfo.point.x} мм, Y: {snapInfo.point.y} мм
          </span>
          <span className="text-[#4a5260]">|</span>
          <span className="text-blue-300">
            Привязка: {SNAP_LABELS[snapInfo.snapType]}
            {snapInfo.angleDeg !== undefined ? ` (${snapInfo.angleDeg}°)` : ""}
          </span>
          {typedLength && (
            <>
              <span className="text-[#4a5260]">|</span>
              <span className="rounded bg-blue-600/30 px-1.5 py-0.5 font-mono text-white">
                Длина: {typedLength} мм (Enter)
              </span>
            </>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => updateGridSettings({ snapEnabled: !snapEnabled })}
            className={`rounded border px-2 py-1 text-[11px] shadow-md transition-colors ${
              snapEnabled
                ? "border-blue-500/60 bg-blue-600/20 text-blue-200"
                : "border-[#2c313a] bg-[#181b20]/95 text-[#9aa2b1]"
            }`}
            title="Включить/отключить привязки"
          >
            Привязка: {snapEnabled ? "ВКЛ" : "ВЫКЛ"}
          </button>

          <div className="flex items-center rounded border border-[#2c313a] bg-[#181b20]/95 p-0.5 shadow-md">
            <button
              type="button"
              onClick={() => setZoomPercent(zoomPercent - 15)}
              className="rounded p-1 text-[#c7cdd8] hover:bg-[#252a33]"
              title="Уменьшить масштаб"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-11 text-center text-[11px] tabular-nums text-[#e6e8ec]">
              {zoomPercent}%
            </span>
            <button
              type="button"
              onClick={() => setZoomPercent(zoomPercent + 15)}
              className="rounded p-1 text-[#c7cdd8] hover:bg-[#252a33]"
              title="Увеличить масштаб"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={fitToScreen}
              className="rounded p-1 text-[#c7cdd8] hover:bg-[#252a33]"
              title="Поместить конструкцию в экран"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoomPercent(100);
                setPanPx({ x: 180, y: 160 });
              }}
              className="rounded p-1 text-[#c7cdd8] hover:bg-[#252a33]"
              title="Сбросить вид (100%)"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Сцена Konva */}
      <Stage
        width={stageSize.width}
        height={stageSize.height}
        onWheel={handleWheel}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onDblClick={() => {
          if (activeTool === "polyline" && polyPointsMm.length >= 2) {
            commitPolyline(polyPointsMm);
          }
        }}
        style={{
          cursor:
            dragAction?.kind === "pan" || spacePressed
              ? "grabbing"
              : activeTool === "select"
                ? "default"
                : "crosshair",
        }}
      >
        {/* Слой 1: Сетка и оси координат */}
        <Layer listening={false}>
          {gridLines.minor.map((points, idx) => (
            <Line key={`mn-${idx}`} points={points} stroke="#1b1f26" strokeWidth={1} />
          ))}
          {gridLines.major.map((points, idx) => (
            <Line key={`mj-${idx}`} points={points} stroke="#282d37" strokeWidth={1} />
          ))}

          {showAxes && (
            <>
              <Line
                points={[0, panPx.y, stageSize.width, panPx.y]}
                stroke="#7f1d1d"
                strokeWidth={1.2}
              />
              <Line
                points={[panPx.x, 0, panPx.x, stageSize.height]}
                stroke="#14532d"
                strokeWidth={1.2}
              />
              <Circle x={panPx.x} y={panPx.y} radius={3.5} fill="#60a5fa" />
              <Text x={panPx.x + 7} y={panPx.y - 14} text="0,0" fill="#9aa2b1" fontSize={10} />
            </>
          )}
        </Layer>

        {/* Слой 2: Элементы конструкции, размеры и соединения */}
        <Layer>
          {project.elements.map((element) => {
            const profile = profileMap.get(element.profileId);
            const color =
              activeTool === "delete" && hoveredElementId === element.id
                ? "#ef4444"
                : element.color ?? profile?.color ?? "#38bdf8";
            const isSelected = selectedElementIds.includes(element.id);

            // Учитываем интерактивное превью сдвига или изменения конца элемента
            let startMm: Point2D = element.start;
            let endMm: Point2D = element.end;

            if (dragAction?.kind === "move" && dragAction.targetIds.includes(element.id)) {
              startMm = {
                x: element.start.x + dragAction.deltaMm.x,
                y: element.start.y + dragAction.deltaMm.y,
              };
              endMm = {
                x: element.end.x + dragAction.deltaMm.x,
                y: element.end.y + dragAction.deltaMm.y,
              };
            } else if (
              dragAction?.kind === "resize_handle" &&
              dragAction.elementId === element.id
            ) {
              if (dragAction.endpoint === "start") startMm = dragAction.currentPointMm;
              else endMm = dragAction.currentPointMm;
            }

            const s = worldToScreen(startMm);
            const e = worldToScreen(endMm);
            const strokeWidthPx = Math.max(4, ((profile?.widthMm ?? 40) * scale) / 1.35);
            const lengthMm = roundMm(Math.hypot(endMm.x - startMm.x, endMm.y - startMm.y));
            const midScreen = worldToScreen(
              getElementMidpoint({
                start: { ...startMm, z: 0 },
                end: { ...endMm, z: 0 },
              })
            );

            return (
              <Group
                key={element.id}
                onMouseDown={(evt) => handleElementMouseDown(evt, element)}
                onMouseEnter={() => setHoveredElementId(element.id)}
                onMouseLeave={() => setHoveredElementId(null)}
              >
                {isSelected && (
                  <Line
                    points={[s.x, s.y, e.x, e.y]}
                    stroke="#ffffff"
                    strokeWidth={strokeWidthPx + 4}
                    opacity={0.75}
                    listening={false}
                  />
                )}

                <Line
                  points={[s.x, s.y, e.x, e.y]}
                  stroke={color}
                  strokeWidth={strokeWidthPx}
                  hitStrokeWidth={18}
                  lineCap="butt"
                />

                <Line
                  points={[s.x, s.y, e.x, e.y]}
                  stroke="#0b0d10"
                  strokeWidth={1}
                  dash={[4, 3]}
                  opacity={0.55}
                  listening={false}
                />

                {showDimensions && (
                  <Group x={midScreen.x} y={midScreen.y - 14} listening={false}>
                    <Rect
                      x={-28}
                      y={-8}
                      width={56}
                      height={15}
                      cornerRadius={3}
                      fill="#141619"
                      opacity={0.88}
                      stroke={element.groupId ? "#38bdf8" : "#2c313a"}
                      strokeWidth={0.8}
                    />
                    <Text
                      x={-28}
                      y={-5}
                      width={56}
                      align="center"
                      text={`${lengthMm} мм`}
                      fill="#e6e8ec"
                      fontSize={9.5}
                      fontFamily="monospace"
                    />
                  </Group>
                )}
              </Group>
            );
          })}

          {/* Призрачные копии при работе инструментом Копия */}
          {dragAction?.kind === "copy" &&
            project.elements
              .filter((el) => dragAction.targetIds.includes(el.id))
              .map((el) => {
                const s = worldToScreen({
                  x: el.start.x + dragAction.deltaMm.x,
                  y: el.start.y + dragAction.deltaMm.y,
                });
                const e = worldToScreen({
                  x: el.end.x + dragAction.deltaMm.x,
                  y: el.end.y + dragAction.deltaMm.y,
                });
                return (
                  <Line
                    key={`copy-preview-${el.id}`}
                    points={[s.x, s.y, e.x, e.y]}
                    stroke="#60a5fa"
                    strokeWidth={6}
                    dash={[6, 4]}
                    opacity={0.8}
                    listening={false}
                  />
                );
              })}

          {/* Ручки изменения концов элемента */}
          {handleVisibleElements.map((el) => {
            const sMm =
              dragAction?.kind === "resize_handle" &&
              dragAction.elementId === el.id &&
              dragAction.endpoint === "start"
                ? dragAction.currentPointMm
                : el.start;
            const eMm =
              dragAction?.kind === "resize_handle" &&
              dragAction.elementId === el.id &&
              dragAction.endpoint === "end"
                ? dragAction.currentPointMm
                : el.end;
            const s = worldToScreen(sMm);
            const e = worldToScreen(eMm);

            return (
              <Group key={`handles-${el.id}`}>
                <Rect
                  x={s.x - 5}
                  y={s.y - 5}
                  width={10}
                  height={10}
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  onMouseDown={(evt) => handleEndpointHandleMouseDown(evt, el, "start")}
                />
                <Rect
                  x={e.x - 5}
                  y={e.y - 5}
                  width={10}
                  height={10}
                  fill="#3b82f6"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  onMouseDown={(evt) => handleEndpointHandleMouseDown(evt, el, "end")}
                />
              </Group>
            );
          })}

          {/* Маркеры пересечений и соединений */}
          {project.displaySettings.showJoints &&
            project.joints.map((joint) => {
              const p = worldToScreen(joint.position);
              return (
                <Circle
                  key={joint.id}
                  x={p.x}
                  y={p.y}
                  radius={4}
                  fill="#fbbf24"
                  stroke="#141619"
                  strokeWidth={1.5}
                  listening={false}
                />
              );
            })}

          {intersections.map((pt, idx) => {
            const p = worldToScreen(pt);
            return (
              <Circle
                key={`inter-${idx}`}
                x={p.x}
                y={p.y}
                radius={2.5}
                fill="#fb923c"
                opacity={0.7}
                listening={false}
              />
            );
          })}
        </Layer>

        {/* Слой 3: Превью черчения, рамка выделения и маркер привязки */}
        <Layer listening={false}>
          {/* Превью линии */}
          {activeTool === "line" && drawStartMm && (
            <>
              <Line
                points={[
                  worldToScreen(drawStartMm).x,
                  worldToScreen(drawStartMm).y,
                  worldToScreen(snapInfo.point).x,
                  worldToScreen(snapInfo.point).y,
                ]}
                stroke={activeProfile?.color ?? "#38bdf8"}
                strokeWidth={Math.max(4, ((activeProfile?.widthMm ?? 40) * scale) / 1.35)}
                opacity={0.7}
                dash={[8, 4]}
              />
              <Text
                x={worldToScreen(snapInfo.point).x + 12}
                y={worldToScreen(snapInfo.point).y - 22}
                text={`${roundMm(
                  Math.hypot(snapInfo.point.x - drawStartMm.x, snapInfo.point.y - drawStartMm.y)
                )} мм`}
                fill="#ffffff"
                fontSize={11}
                fontFamily="monospace"
              />
            </>
          )}

          {/* Превью прямоугольника */}
          {activeTool === "rectangle" && drawStartMm && (
            <>
              <Rect
                x={Math.min(worldToScreen(drawStartMm).x, worldToScreen(snapInfo.point).x)}
                y={Math.min(worldToScreen(drawStartMm).y, worldToScreen(snapInfo.point).y)}
                width={Math.abs(worldToScreen(snapInfo.point).x - worldToScreen(drawStartMm).x)}
                height={Math.abs(worldToScreen(snapInfo.point).y - worldToScreen(drawStartMm).y)}
                stroke={activeProfile?.color ?? "#38bdf8"}
                strokeWidth={3}
                dash={[6, 4]}
                fill="#3b82f6"
                opacity={0.18}
              />
              <Text
                x={worldToScreen(snapInfo.point).x + 10}
                y={worldToScreen(snapInfo.point).y - 20}
                text={`${roundMm(Math.abs(snapInfo.point.x - drawStartMm.x))} × ${roundMm(
                  Math.abs(snapInfo.point.y - drawStartMm.y)
                )} мм`}
                fill="#ffffff"
                fontSize={11}
                fontFamily="monospace"
              />
            </>
          )}

          {/* Превью ломаной */}
          {activeTool === "polyline" && polyPointsMm.length > 0 && (
            <>
              <Line
                points={[
                  ...polyPointsMm.flatMap((pt) => {
                    const s = worldToScreen(pt);
                    return [s.x, s.y];
                  }),
                  worldToScreen(snapInfo.point).x,
                  worldToScreen(snapInfo.point).y,
                ]}
                stroke={activeProfile?.color ?? "#38bdf8"}
                strokeWidth={Math.max(3, ((activeProfile?.widthMm ?? 40) * scale) / 1.5)}
                dash={[6, 4]}
                opacity={0.8}
              />
              {activeAnchor && (
                <Text
                  x={worldToScreen(snapInfo.point).x + 12}
                  y={worldToScreen(snapInfo.point).y - 22}
                  text={`${roundMm(
                    Math.hypot(snapInfo.point.x - activeAnchor.x, snapInfo.point.y - activeAnchor.y)
                  )} мм`}
                  fill="#ffffff"
                  fontSize={11}
                  fontFamily="monospace"
                />
              )}
            </>
          )}

          {/* Рамка множественного выделения */}
          {dragAction?.kind === "marquee" && (
            <Rect
              x={Math.min(
                worldToScreen(dragAction.startMm).x,
                worldToScreen(dragAction.currentMm).x
              )}
              y={Math.min(
                worldToScreen(dragAction.startMm).y,
                worldToScreen(dragAction.currentMm).y
              )}
              width={Math.abs(
                worldToScreen(dragAction.currentMm).x - worldToScreen(dragAction.startMm).x
              )}
              height={Math.abs(
                worldToScreen(dragAction.currentMm).y - worldToScreen(dragAction.startMm).y
              )}
              fill="#3b82f6"
              opacity={0.14}
              stroke="#60a5fa"
              strokeWidth={1}
              dash={[4, 3]}
            />
          )}

          {/* Индикатор активной точки привязки */}
          {snapInfo.snapType === "endpoint" && (
            <Rect
              x={worldToScreen(snapInfo.point).x - 5}
              y={worldToScreen(snapInfo.point).y - 5}
              width={10}
              height={10}
              stroke="#22c55e"
              strokeWidth={2}
            />
          )}
          {snapInfo.snapType === "intersection" && (
            <Circle
              x={worldToScreen(snapInfo.point).x}
              y={worldToScreen(snapInfo.point).y}
              radius={6}
              stroke="#f97316"
              strokeWidth={2}
            />
          )}
          {(snapInfo.snapType === "angle" || snapInfo.snapType === "grid") && (
            <Circle
              x={worldToScreen(snapInfo.point).x}
              y={worldToScreen(snapInfo.point).y}
              radius={3.5}
              fill={snapInfo.snapType === "angle" ? "#38bdf8" : "#60a5fa"}
            />
          )}
        </Layer>
      </Stage>

      {/* Подсказка снизу */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-[#2c313a] bg-[#181b20]/90 px-2.5 py-1 text-[11px] text-[#9aa2b1]">
        {activeTool === "line" &&
          "Линия: кликните начало и конец, либо введите длину с клавиатуры и нажмите Enter."}
        {activeTool === "rectangle" &&
          "Прямоугольник: укажите два противоположных угла для создания рамы из 4 профилей."}
        {activeTool === "polyline" &&
          "Ломаная: кликайте вершины по очереди; двойной клик, ПКМ или Enter завершают контур."}
        {activeTool === "select" &&
          "Выбор: клик или рамка (Shift — добавить). Тяните синие ручки на концах для изменения длины."}
        {activeTool === "move" && "Перемещение: потяните элемент или выделенную группу."}
        {activeTool === "copy" && "Копирование: потяните элемент или группу в новое место."}
        {activeTool === "resize" && "Размер: наведите на элемент и перетяните конечную ручку."}
        {activeTool === "delete" && "Удаление: кликните по элементу, чтобы удалить его."}
      </div>
    </div>
  );
}
