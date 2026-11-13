"use client";

import Konva from "konva";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import { Maximize2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { getElementLengthMm, getElementMidpoint, roundMm } from "@/lib/geometry/elements";
import {
  delta2DToDelta3D,
  distancePointToSegment2D,
  getAllIntersectionsOnPlane,
  getSnapPointOnPlane,
  getThirdCoord3D,
  isElementInSelectionRectOnPlane,
  planeCoordsToPoint3D,
  projectPoint3DToPlane2D,
  type OrthoPlane,
  type PlaneSnapResult,
} from "@/lib/geometry/snapping";
import { buildRectangleSegments3D } from "@/lib/geometry/snapping3d";
import { useProjectStore } from "@/store/useProjectStore";
import { CANVAS_PALETTES, useThemeStore, type CanvasThemePalette } from "@/store/useThemeStore";
import type { ConstructionElement, MaterialProfile, Point2D, Point3D } from "@/types";

const BASE_PX_PER_MM = 0.4;
const MIN_ZOOM_FACTOR = 0.1;
const MAX_ZOOM_FACTOR = 4.0;

interface DraftVertex {
  planePt: Point2D;
  point3D: Point3D;
}

type DragAction =
  | {
      kind: "pan";
      startScreen: Point2D;
      startPanPx: Point2D;
    }
  | {
      kind: "move";
      targetIds: string[];
      anchorWorldMm: Point2D;
      deltaMm: Point2D;
      copyMode: boolean;
    }
  | {
      kind: "resize_handle";
      elementId: string;
      endpoint: "start" | "end";
      currentPointMm: Point2D;
      thirdCoordMm: number;
    }
  | {
      kind: "marquee";
      startWorldMm: Point2D;
      currentWorldMm: Point2D;
      additive: boolean;
    };

export interface OrthogonalViewportHandle {
  fitToScreen: () => void;
  cancelDraft: () => void;
  finishPolyline: () => void;
}

interface OrthogonalViewport2DProps {
  plane: OrthoPlane;
  title: string;
  subtitle?: string;
  isPrimary?: boolean;
  isFocused: boolean;
  onFocus: () => void;
}

function clampZoomFactor(value: number): number {
  return Math.max(MIN_ZOOM_FACTOR, Math.min(MAX_ZOOM_FACTOR, value));
}

function niceAxisLabels(
  plane: OrthoPlane,
  palette: CanvasThemePalette
): {
  uLabel: string;
  uStroke: string;
  uText: string;
  vLabel: string;
  vStroke: string;
  vText: string;
} {
  if (plane === "xz") {
    return {
      uLabel: "X",
      uStroke: palette.axisX,
      uText: palette.axisXText,
      vLabel: "Z (высота)",
      vStroke: palette.axisZ,
      vText: palette.axisZText,
    };
  }
  if (plane === "yz") {
    return {
      uLabel: "Y",
      uStroke: palette.axisY,
      uText: palette.axisYText,
      vLabel: "Z (высота)",
      vStroke: palette.axisZ,
      vText: palette.axisZText,
    };
  }
  return {
    uLabel: "X",
    uStroke: palette.axisX,
    uText: palette.axisXText,
    vLabel: "Y",
    vStroke: palette.axisY,
    vText: palette.axisYText,
  };
}

function getSmartGridSpacing(scalePxPerMm: number, minorMm: number, majorMm: number) {
  const safeMinor = Math.max(10, minorMm);
  const safeMajor = Math.max(safeMinor * 2, majorMm);
  const minorPx = safeMinor * scalePxPerMm;
  const renderMinor = minorPx >= 8;
  let effectiveMajor = safeMajor;
  while (effectiveMajor * scalePxPerMm < 42) {
    effectiveMajor *= 2;
  }
  return {
    renderMinor,
    minorStep: safeMinor,
    majorStep: effectiveMajor,
  };
}

function getPreviewOffsetLabel(
  deltaMm: Point2D,
  plane: OrthoPlane
): string {
  const axisU = plane === "yz" ? "dY" : "dX";
  const axisV = plane === "xy" ? "dY" : "dZ";
  return `${axisU}: ${roundMm(deltaMm.x)} мм · ${axisV}: ${roundMm(deltaMm.y)} мм`;
}

export const OrthogonalViewport2D = forwardRef<
  OrthogonalViewportHandle,
  OrthogonalViewport2DProps
>(function OrthogonalViewport2D(
  { plane, title, subtitle, isPrimary = false, isFocused, onFocus },
  ref
) {
  const project = useProjectStore((s) => s.project);
  const activeTool = useProjectStore((s) => s.activeTool);
  const activeProfileId = useProjectStore((s) => s.activeProfileId);
  const selectedElementIds = useProjectStore((s) => s.selectedElementIds);
  const selectedJointId = useProjectStore((s) => s.selectedJointId);
  const theme = useThemeStore((s) => s.theme);
  const palette = CANVAS_PALETTES[theme];

  const setActiveTool = useProjectStore((s) => s.setActiveTool);
  const selectElement = useProjectStore((s) => s.selectElement);
  const selectMultipleElements = useProjectStore((s) => s.selectMultipleElements);
  const selectJoint = useProjectStore((s) => s.selectJoint);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const setZoomPercent = useProjectStore((s) => s.setZoomPercent);
  const addElement = useProjectStore((s) => s.addElement);
  const addElementsBatch = useProjectStore((s) => s.addElementsBatch);
  const setElementEndpoints = useProjectStore((s) => s.setElementEndpoints);
  const moveElements = useProjectStore((s) => s.moveElements);
  const copyElements = useProjectStore((s) => s.copyElements);
  const deleteElements = useProjectStore((s) => s.deleteElements);

  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);

  const [size, setSize] = useState({ width: 640, height: 420 });
  const [localZoomFactor, setLocalZoomFactor] = useState(plane === "xy" ? 1 : 0.72);
  const [panPx, setPanPx] = useState<Point2D>(() =>
    plane === "xy" ? { x: 140, y: 120 } : { x: 110, y: 260 }
  );
  const hasAutoFittedRef = useRef(false);

  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [cursorPlaneMm, setCursorPlaneMm] = useState<Point2D | null>(null);
  const [snapInfo, setSnapInfo] = useState<PlaneSnapResult | null>(null);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const [lineDraft, setLineDraft] = useState<DraftVertex | null>(null);
  const [polylineDraft, setPolylineDraft] = useState<DraftVertex[]>([]);
  const [rectDraft, setRectDraft] = useState<DraftVertex | null>(null);
  const [dragAction, setDragAction] = useState<DragAction | null>(null);

  const zoomFactor = isPrimary
    ? clampZoomFactor((project.displaySettings.zoomPercent || 100) / 100)
    : localZoomFactor;
  const scale = zoomFactor * BASE_PX_PER_MM;
  // На плоскости XY ось +Y направлена вниз; на XZ/YZ ось +Z (высота) направлена вверх
  const vSign = plane === "xy" ? 1 : -1;

  const { elements, profiles, joints, gridSettings, displaySettings } = project;
  const selectedSet = useMemo(() => new Set(selectedElementIds), [selectedElementIds]);

  const profileMap = useMemo(() => {
    const map = new Map<string, MaterialProfile>();
    for (const p of profiles) map.set(p.id, p);
    return map;
  }, [profiles]);

  const worldToScreen = useCallback(
    (p: Point2D): Point2D => ({
      x: panPx.x + p.x * scale,
      y: panPx.y + p.y * vSign * scale,
    }),
    [panPx.x, panPx.y, scale, vSign]
  );

  const screenToWorld = useCallback(
    (sx: number, sy: number): Point2D => ({
      x: (sx - panPx.x) / scale,
      y: ((sy - panPx.y) / scale) * vSign,
    }),
    [panPx.x, panPx.y, scale, vSign]
  );

  const updateZoom = useCallback(
    (nextFactor: number) => {
      const clamped = clampZoomFactor(nextFactor);
      if (isPrimary) {
        setZoomPercent(Math.round(clamped * 100));
      } else {
        setLocalZoomFactor(clamped);
      }
    },
    [isPrimary, setZoomPercent]
  );

  const computeFitTransform = useCallback(
    (width: number, height: number) => {
      if (elements.length === 0) {
        return {
          zoom: isPrimary ? 1 : 0.72,
          pan:
            plane === "xy"
              ? { x: Math.round(width * 0.2), y: Math.round(height * 0.22) }
              : { x: Math.round(width * 0.22), y: Math.round(height * 0.78) },
        };
      }

      let minU = Infinity;
      let maxU = -Infinity;
      let minV = Infinity;
      let maxV = -Infinity;

      for (const el of elements) {
        const s = projectPoint3DToPlane2D(el.start, plane);
        const e = projectPoint3DToPlane2D(el.end, plane);
        minU = Math.min(minU, s.x, e.x);
        maxU = Math.max(maxU, s.x, e.x);
        minV = Math.min(minV, s.y, e.y);
        maxV = Math.max(maxV, s.y, e.y);
      }

      const spanU = Math.max(600, maxU - minU);
      const spanV = Math.max(500, maxV - minV);
      const padding = isPrimary ? 90 : 38;
      const availW = Math.max(80, width - padding * 2);
      const availH = Math.max(80, height - padding * 2);

      const targetScale = Math.min(availW / spanU, availH / spanV);
      const targetZoom = clampZoomFactor(
        Math.round((targetScale / BASE_PX_PER_MM) * 20) / 20
      );
      const nextScale = targetZoom * BASE_PX_PER_MM;

      const centerU = (minU + maxU) / 2;
      const centerV = (minV + maxV) / 2;

      return {
        zoom: targetZoom,
        pan: {
          x: Math.round(width / 2 - centerU * nextScale),
          y: Math.round(height / 2 - centerV * vSign * nextScale),
        },
      };
    },
    [elements, isPrimary, plane, vSign]
  );

  const fitToScreen = useCallback(() => {
    const next = computeFitTransform(size.width, size.height);
    updateZoom(next.zoom);
    setPanPx(next.pan);
  }, [computeFitTransform, size.height, size.width, updateZoom]);

  const cancelDraft = useCallback(() => {
    setLineDraft(null);
    setPolylineDraft([]);
    setRectDraft(null);
    setDragAction(null);
  }, []);

  const finishPolyline = useCallback(() => {
    setPolylineDraft([]);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      fitToScreen,
      cancelDraft,
      finishPolyline,
    }),
    [cancelDraft, finishPolyline, fitToScreen]
  );

  // Отслеживание размера панели и первичная центровка вида при монтировании
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const nextWidth = Math.max(180, Math.floor(entry.contentRect.width));
      const nextHeight = Math.max(140, Math.floor(entry.contentRect.height));
      setSize({ width: nextWidth, height: nextHeight });

      if (!hasAutoFittedRef.current && nextWidth > 0 && nextHeight > 0) {
        hasAutoFittedRef.current = true;
        const fitted = computeFitTransform(nextWidth, nextHeight);
        if (isPrimary) {
          setZoomPercent(Math.round(fitted.zoom * 100));
        } else {
          setLocalZoomFactor(fitted.zoom);
        }
        setPanPx(fitted.pan);
      }
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, [computeFitTransform, isPrimary, setZoomPercent]);

  // Отслеживаем пробел для режима панорамирования рукой
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        const target = event.target as HTMLElement | null;
        const isInput =
          target &&
          (target.tagName === "INPUT" ||
            target.tagName === "TEXTAREA" ||
            target.tagName === "SELECT");
        if (!isInput) setIsSpacePressed(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setIsSpacePressed(false);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const computeSnap = useCallback(
    (
      rawWorld: Point2D,
      anchorPt?: DraftVertex | null,
      excludeIds?: Set<string>
    ): PlaneSnapResult => {
      const snapRadiusMm = Math.max(18, 16 / scale);
      return getSnapPointOnPlane(rawWorld, elements, gridSettings, plane, {
        anchorMm: anchorPt?.planePt ?? null,
        preferredThirdCoordMm: anchorPt ? getThirdCoord3D(anchorPt.point3D, plane) : 0,
        snapRadiusMm,
        excludeElementIds: excludeIds,
      });
    },
    [elements, gridSettings, plane, scale]
  );

  const findTopElementAt = useCallback(
    (worldMm: Point2D): ConstructionElement | null => {
      const toleranceMm = Math.max(14, 14 / scale);
      let best: ConstructionElement | null = null;
      let bestDist = toleranceMm;

      for (let i = elements.length - 1; i >= 0; i -= 1) {
        const el = elements[i];
        const a = projectPoint3DToPlane2D(el.start, plane);
        const b = projectPoint3DToPlane2D(el.end, plane);
        const d = distancePointToSegment2D(worldMm, a, b);
        if (d <= bestDist) {
          bestDist = d;
          best = el;
        }
      }
      return best;
    },
    [elements, plane, scale]
  );

  const findEndpointHandleAt = useCallback(
    (worldMm: Point2D): { element: ConstructionElement; endpoint: "start" | "end" } | null => {
      if (activeTool !== "resize" && activeTool !== "select") return null;
      const hitRadiusMm = Math.max(16, 15 / scale);

      for (let i = elements.length - 1; i >= 0; i -= 1) {
        const el = elements[i];
        if (!selectedSet.has(el.id)) continue;
        const s2d = projectPoint3DToPlane2D(el.start, plane);
        const e2d = projectPoint3DToPlane2D(el.end, plane);
        if (Math.hypot(worldMm.x - s2d.x, worldMm.y - s2d.y) <= hitRadiusMm) {
          return { element: el, endpoint: "start" };
        }
        if (Math.hypot(worldMm.x - e2d.x, worldMm.y - e2d.y) <= hitRadiusMm) {
          return { element: el, endpoint: "end" };
        }
      }
      return null;
    },
    [activeTool, elements, plane, scale, selectedSet]
  );

  const draftPointTo3D = useCallback(
    (snap: PlaneSnapResult, fallbackThirdMm = 0): Point3D => {
      if (snap.sourcePoint3D) return { ...snap.sourcePoint3D };
      return planeCoordsToPoint3D(snap.point.x, snap.point.y, plane, fallbackThirdMm);
    },
    [plane]
  );

  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    onFocus();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const nativeEvt = event.evt;

    // Средняя кнопка или Пробел + ЛКМ -> Панорамирование
    if (nativeEvt.button === 1 || (nativeEvt.button === 0 && isSpacePressed)) {
      nativeEvt.preventDefault();
      setDragAction({
        kind: "pan",
        startScreen: { x: pointer.x, y: pointer.y },
        startPanPx: { ...panPx },
      });
      return;
    }

    if (nativeEvt.button !== 0) return;

    const rawWorld = screenToWorld(pointer.x, pointer.y);

    // Инструмент: Удаление по клику
    if (activeTool === "delete") {
      const hit = findTopElementAt(rawWorld);
      if (hit) {
        deleteElements([hit.id]);
      }
      return;
    }

    // Инструмент: Линия
    if (activeTool === "line") {
      const snapped = computeSnap(rawWorld, lineDraft);
      if (!lineDraft) {
        setLineDraft({
          planePt: snapped.point,
          point3D: draftPointTo3D(snapped, 0),
        });
      } else {
        const end3D = draftPointTo3D(
          snapped,
          getThirdCoord3D(lineDraft.point3D, plane)
        );
        if (getElementLengthMm({ start: lineDraft.point3D, end: end3D }) >= 1) {
          addElement(lineDraft.point3D, end3D, activeProfileId);
        }
        setLineDraft(null);
      }
      return;
    }

    // Инструмент: Полилиния
    if (activeTool === "polyline") {
      const prevAnchor =
        polylineDraft.length > 0 ? polylineDraft[polylineDraft.length - 1] : null;
      const snapped = computeSnap(rawWorld, prevAnchor);

      if (!prevAnchor) {
        setPolylineDraft([
          {
            planePt: snapped.point,
            point3D: draftPointTo3D(snapped, 0),
          },
        ]);
      } else {
        const next3D = draftPointTo3D(
          snapped,
          getThirdCoord3D(prevAnchor.point3D, plane)
        );
        if (getElementLengthMm({ start: prevAnchor.point3D, end: next3D }) >= 1) {
          addElement(prevAnchor.point3D, next3D, activeProfileId);
          setPolylineDraft((prev) => [
            ...prev,
            { planePt: snapped.point, point3D: next3D },
          ]);
        }
      }
      return;
    }

    // Инструмент: Прямоугольник (работает в любой плоскости XY, XZ, YZ!)
    if (activeTool === "rectangle") {
      const snapped = computeSnap(rawWorld, rectDraft);
      if (!rectDraft) {
        setRectDraft({
          planePt: snapped.point,
          point3D: draftPointTo3D(snapped, 0),
        });
      } else {
        const corner2 = draftPointTo3D(
          snapped,
          getThirdCoord3D(rectDraft.point3D, plane)
        );
        const segments = buildRectangleSegments3D(rectDraft.point3D, corner2, plane);
        if (segments.length > 0) {
          addElementsBatch(
            segments.map((seg) => ({
              start: seg.start,
              end: seg.end,
              profileId: activeProfileId,
            }))
          );
        }
        setRectDraft(null);
      }
      return;
    }

    // Проверка перетаскивания вершины выделенного элемента
    const handleHit = findEndpointHandleAt(rawWorld);
    if (handleHit) {
      const currentPt3D =
        handleHit.endpoint === "start" ? handleHit.element.start : handleHit.element.end;
      setDragAction({
        kind: "resize_handle",
        elementId: handleHit.element.id,
        endpoint: handleHit.endpoint,
        currentPointMm: projectPoint3DToPlane2D(currentPt3D, plane),
        thirdCoordMm: getThirdCoord3D(currentPt3D, plane),
      });
      return;
    }

    // Инструменты Выделить / Переместить / Копировать / Изменить длину
    const hitEl = findTopElementAt(rawWorld);
    const additive = nativeEvt.shiftKey || nativeEvt.ctrlKey || nativeEvt.metaKey;

    if (hitEl) {
      let nextTargetIds = selectedElementIds;
      if (additive) {
        selectElement(hitEl.id, true);
        nextTargetIds = selectedSet.has(hitEl.id)
          ? selectedElementIds.filter((id) => id !== hitEl.id)
          : [...selectedElementIds, hitEl.id];
      } else if (!selectedSet.has(hitEl.id)) {
        selectElement(hitEl.id, false);
        nextTargetIds = [hitEl.id];
      }

      if (
        activeTool === "move" ||
        activeTool === "copy" ||
        (activeTool === "select" && !additive && nextTargetIds.length > 0)
      ) {
        const snappedAnchor = computeSnap(rawWorld);
        setDragAction({
          kind: "move",
          targetIds: nextTargetIds,
          anchorWorldMm: snappedAnchor.point,
          deltaMm: { x: 0, y: 0 },
          copyMode: activeTool === "copy" || nativeEvt.altKey,
        });
      }
      return;
    }

    // Пустое место -> рамка выделения
    if (!additive) {
      clearSelection();
    }
    setDragAction({
      kind: "marquee",
      startWorldMm: rawWorld,
      currentWorldMm: rawWorld,
      additive,
    });
  };

  const handleStageMouseMove = () => {
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    if (dragAction?.kind === "pan") {
      const dx = pointer.x - dragAction.startScreen.x;
      const dy = pointer.y - dragAction.startScreen.y;
      setPanPx({
        x: dragAction.startPanPx.x + dx,
        y: dragAction.startPanPx.y + dy,
      });
      return;
    }

    const rawWorld = screenToWorld(pointer.x, pointer.y);

    if (dragAction?.kind === "move") {
      const exclude = dragAction.copyMode ? undefined : new Set(dragAction.targetIds);
      const snapped = computeSnap(
        rawWorld,
        {
          planePt: dragAction.anchorWorldMm,
          point3D: planeCoordsToPoint3D(
            dragAction.anchorWorldMm.x,
            dragAction.anchorWorldMm.y,
            plane,
            0
          ),
        },
        exclude
      );
      setCursorPlaneMm(snapped.point);
      setSnapInfo(snapped);
      setDragAction({
        ...dragAction,
        deltaMm: {
          x: roundMm(snapped.point.x - dragAction.anchorWorldMm.x),
          y: roundMm(snapped.point.y - dragAction.anchorWorldMm.y),
        },
      });
      return;
    }

    if (dragAction?.kind === "resize_handle") {
      const snapped = computeSnap(
        rawWorld,
        null,
        new Set([dragAction.elementId])
      );
      setCursorPlaneMm(snapped.point);
      setSnapInfo(snapped);
      setDragAction({
        ...dragAction,
        currentPointMm: snapped.point,
        thirdCoordMm: snapped.sourcePoint3D
          ? getThirdCoord3D(snapped.sourcePoint3D, plane)
          : dragAction.thirdCoordMm,
      });
      return;
    }

    if (dragAction?.kind === "marquee") {
      setCursorPlaneMm({ x: roundMm(rawWorld.x), y: roundMm(rawWorld.y) });
      setDragAction({
        ...dragAction,
        currentWorldMm: rawWorld,
      });
      return;
    }

    const activeAnchor =
      activeTool === "line"
        ? lineDraft
        : activeTool === "polyline" && polylineDraft.length > 0
          ? polylineDraft[polylineDraft.length - 1]
          : activeTool === "rectangle"
            ? rectDraft
            : null;

    const snapped = computeSnap(rawWorld, activeAnchor);
    setCursorPlaneMm(snapped.point);
    setSnapInfo(snapped);

    if (!dragAction) {
      const hovered = findTopElementAt(rawWorld);
      setHoveredElementId(hovered?.id ?? null);
    }
  };

  const handleStageMouseUp = () => {
    if (!dragAction) return;

    if (dragAction.kind === "move") {
      if (Math.abs(dragAction.deltaMm.x) >= 1 || Math.abs(dragAction.deltaMm.y) >= 1) {
        const delta3D = delta2DToDelta3D(dragAction.deltaMm.x, dragAction.deltaMm.y, plane);
        if (dragAction.copyMode) {
          copyElements(dragAction.targetIds, delta3D);
          if (activeTool === "copy") setActiveTool("select");
        } else {
          moveElements(dragAction.targetIds, delta3D);
        }
      }
    } else if (dragAction.kind === "resize_handle") {
      const el = elements.find((item) => item.id === dragAction.elementId);
      if (el) {
        const nextEndpoint3D = planeCoordsToPoint3D(
          dragAction.currentPointMm.x,
          dragAction.currentPointMm.y,
          plane,
          dragAction.thirdCoordMm
        );
        const nextStart = dragAction.endpoint === "start" ? nextEndpoint3D : el.start;
        const nextEnd = dragAction.endpoint === "end" ? nextEndpoint3D : el.end;
        if (getElementLengthMm({ start: nextStart, end: nextEnd }) >= 1) {
          setElementEndpoints(el.id, nextStart, nextEnd);
        }
      }
    } else if (dragAction.kind === "marquee") {
      const rect = {
        x1: dragAction.startWorldMm.x,
        y1: dragAction.startWorldMm.y,
        x2: dragAction.currentWorldMm.x,
        y2: dragAction.currentWorldMm.y,
      };
      if (Math.abs(rect.x2 - rect.x1) > 4 || Math.abs(rect.y2 - rect.y1) > 4) {
        const matchedIds = elements
          .filter((el) => isElementInSelectionRectOnPlane(el, rect, plane))
          .map((el) => el.id);
        selectMultipleElements(matchedIds, dragAction.additive);
      }
    }

    setDragAction(null);
  };

  const handleStageDoubleClick = () => {
    if (activeTool === "polyline" && polylineDraft.length > 0) {
      setPolylineDraft([]);
    }
  };

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const worldBefore = screenToWorld(pointer.x, pointer.y);
    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const stepFactor = direction > 0 ? 1.12 : 1 / 1.12;
    const nextZoomRaw = clampZoomFactor(zoomFactor * stepFactor);
    const nextPercent = Math.max(10, Math.min(400, Math.round(nextZoomRaw * 100)));
    const effectiveZoom = isPrimary ? nextPercent / 100 : nextZoomRaw;
    const nextScale = effectiveZoom * BASE_PX_PER_MM;

    updateZoom(effectiveZoom);
    setPanPx({
      x: pointer.x - worldBefore.x * nextScale,
      y: pointer.y - worldBefore.y * vSign * nextScale,
    });
  };

  // Расчёт видимых границ в плоскости для адаптивной сетки
  const gridLines = useMemo(() => {
    if (!gridSettings.showGrid) return { minor: [], major: [] };

    const { renderMinor, minorStep, majorStep } = getSmartGridSpacing(
      scale,
      gridSettings.minorStepMm,
      gridSettings.majorStepMm
    );

    const topLeft = screenToWorld(0, 0);
    const bottomRight = screenToWorld(size.width, size.height);
    const minU = Math.min(topLeft.x, bottomRight.x);
    const maxU = Math.max(topLeft.x, bottomRight.x);
    const minV = Math.min(topLeft.y, bottomRight.y);
    const maxV = Math.max(topLeft.y, bottomRight.y);

    const minor: Array<{ points: number[] }> = [];
    const major: Array<{ points: number[] }> = [];

    if (renderMinor) {
      const startU = Math.floor(minU / minorStep) * minorStep;
      const startV = Math.floor(minV / minorStep) * minorStep;
      for (let u = startU; u <= maxU; u += minorStep) {
        if (Math.abs(u % majorStep) < 1e-3) continue;
        const sx = worldToScreen({ x: u, y: 0 }).x;
        minor.push({ points: [sx, 0, sx, size.height] });
      }
      for (let v = startV; v <= maxV; v += minorStep) {
        if (Math.abs(v % majorStep) < 1e-3) continue;
        const sy = worldToScreen({ x: 0, y: v }).y;
        minor.push({ points: [0, sy, size.width, sy] });
      }
    }

    const startMajU = Math.floor(minU / majorStep) * majorStep;
    const startMajV = Math.floor(minV / majorStep) * majorStep;
    for (let u = startMajU; u <= maxU; u += majorStep) {
      const sx = worldToScreen({ x: u, y: 0 }).x;
      major.push({ points: [sx, 0, sx, size.height] });
    }
    for (let v = startMajV; v <= maxV; v += majorStep) {
      const sy = worldToScreen({ x: 0, y: v }).y;
      major.push({ points: [0, sy, size.width, sy] });
    }

    return { minor, major };
  }, [
    gridSettings.majorStepMm,
    gridSettings.minorStepMm,
    gridSettings.showGrid,
    scale,
    screenToWorld,
    size.height,
    size.width,
    worldToScreen,
  ]);

  const intersections = useMemo(() => {
    if (!gridSettings.snapEnabled || !gridSettings.snapToIntersections) return [];
    return getAllIntersectionsOnPlane(elements, plane);
  }, [elements, gridSettings.snapEnabled, gridSettings.snapToIntersections, plane]);

  const originScreen = worldToScreen({ x: 0, y: 0 });
  const axisMeta = niceAxisLabels(plane, palette);

  const canvasCursor = useMemo(() => {
    if (dragAction?.kind === "pan") return "grabbing";
    if (isSpacePressed) return "grab";
    if (activeTool === "line" || activeTool === "polyline" || activeTool === "rectangle") {
      return "crosshair";
    }
    if (activeTool === "delete") return "not-allowed";
    if (dragAction?.kind === "move" || dragAction?.kind === "resize_handle") return "grabbing";
    if (hoveredElementId) return "pointer";
    return "default";
  }, [activeTool, dragAction?.kind, hoveredElementId, isSpacePressed]);

  const axisCoordText = useMemo(() => {
    const uName = plane === "yz" ? "Y" : "X";
    const vName = plane === "xy" ? "Y" : "Z";
    const uVal = cursorPlaneMm ? `${Math.round(cursorPlaneMm.x)}` : "—";
    const vVal = cursorPlaneMm ? `${Math.round(cursorPlaneMm.y)}` : "—";
    return `${uName}: ${uVal} · ${vName}: ${vVal} мм`;
  }, [cursorPlaneMm, plane]);

  return (
    <div
      ref={containerRef}
      data-testid={`viewport-${plane}`}
      onMouseDown={onFocus}
      style={{ cursor: canvasCursor, backgroundColor: palette.canvasBg }}
      className={`relative h-full w-full overflow-hidden select-none transition-shadow ${
        isFocused
          ? "ring-1 ring-inset ring-[var(--mc-brand-border)]"
          : "ring-1 ring-inset ring-[var(--mc-border)]"
      }`}
    >
      {/* Заголовок вида и кнопки масштабирования */}
      <div className="pointer-events-none absolute left-2.5 right-2.5 top-2.5 z-10 flex items-center justify-between gap-2">
        <div
          className={`pointer-events-auto flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] shadow-md ${
            isFocused
              ? "border-[var(--mc-brand-border)] bg-[var(--mc-bg-panel)]/95 text-[var(--mc-text)]"
              : "border-[var(--mc-border)] bg-[var(--mc-bg-panel)]/95 text-[var(--mc-text-muted)]"
          }`}
        >
          <span className="font-semibold text-[var(--mc-text)]">{title}</span>
          {subtitle && (
            <span className="hidden text-[10px] text-[var(--mc-text-muted)] sm:inline">
              · {subtitle}
            </span>
          )}
        </div>

        <div className="pointer-events-auto flex items-center rounded border border-[var(--mc-border)] bg-[var(--mc-bg-panel)]/95 p-0.5 shadow-md">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
              updateZoom(zoomFactor / 1.15);
            }}
            className="rounded p-1 text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
            title="Уменьшить масштаб"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-10 text-center text-[11px] tabular-nums text-[var(--mc-text)]">
            {Math.round(zoomFactor * 100)}%
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
              updateZoom(zoomFactor * 1.15);
            }}
            className="rounded p-1 text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
            title="Увеличить масштаб"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
              fitToScreen();
            }}
            title="Поместить конструкцию в этот вид"
            className="rounded p-1 text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onFocus();
              updateZoom(1);
              setPanPx(
                plane === "xy"
                  ? { x: 180, y: 160 }
                  : { x: Math.round(size.width * 0.22), y: Math.round(size.height * 0.78) }
              );
            }}
            title="Сбросить вид (100%)"
            className="rounded p-1 text-[var(--mc-text-secondary)] hover:bg-[var(--mc-bg-hover)] hover:text-[var(--mc-text)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <Stage
        ref={stageRef}
        width={size.width}
        height={size.height}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onDblClick={handleStageDoubleClick}
        onWheel={handleWheel}
        onContextMenu={(e) => e.evt.preventDefault()}
      >
        {/* Сетка и оси координат */}
        <Layer listening={false}>
          {gridLines.minor.map((line, idx) => (
            <Line
              key={`min-${idx}`}
              points={line.points}
              stroke={palette.gridMinor}
              strokeWidth={1}
            />
          ))}
          {gridLines.major.map((line, idx) => (
            <Line
              key={`maj-${idx}`}
              points={line.points}
              stroke={palette.gridMajor}
              strokeWidth={1}
            />
          ))}

          {gridSettings.showAxes && (
            <Group>
              {/* Ось U (горизонтальная) */}
              <Line
                points={[0, originScreen.y, size.width, originScreen.y]}
                stroke={axisMeta.uStroke}
                strokeWidth={1.2}
              />
              {/* Ось V (вертикальная) */}
              <Line
                points={[originScreen.x, 0, originScreen.x, size.height]}
                stroke={axisMeta.vStroke}
                strokeWidth={1.2}
              />
              <Circle
                x={originScreen.x}
                y={originScreen.y}
                radius={3.5}
                fill={palette.originDot}
              />
              <Text
                x={Math.min(size.width - 70, Math.max(8, originScreen.x + 8))}
                y={Math.min(size.height - 20, Math.max(36, originScreen.y - 16))}
                text={axisMeta.uLabel}
                fontSize={10}
                fontStyle="bold"
                fill={axisMeta.uText}
              />
              <Text
                x={Math.min(size.width - 75, Math.max(8, originScreen.x + 6))}
                y={
                  plane === "xy"
                    ? Math.min(size.height - 18, Math.max(46, originScreen.y + 8))
                    : 38
                }
                text={axisMeta.vLabel}
                fontSize={10}
                fontStyle="bold"
                fill={axisMeta.vText}
              />
            </Group>
          )}
        </Layer>

        {/* Элементы конструкции и реальные 3D-размеры */}
        <Layer>
          {elements.map((element) => {
            const profile = profileMap.get(element.profileId);
            const isSelected = selectedSet.has(element.id);
            const isHovered = hoveredElementId === element.id;

            let start3D: Point3D = { ...element.start };
            let end3D: Point3D = { ...element.end };

            if (dragAction?.kind === "move" && dragAction.targetIds.includes(element.id)) {
              const delta3D = delta2DToDelta3D(
                dragAction.deltaMm.x,
                dragAction.deltaMm.y,
                plane
              );
              start3D = {
                x: element.start.x + delta3D.x,
                y: element.start.y + delta3D.y,
                z: element.start.z + delta3D.z,
              };
              end3D = {
                x: element.end.x + delta3D.x,
                y: element.end.y + delta3D.y,
                z: element.end.z + delta3D.z,
              };
            } else if (
              dragAction?.kind === "resize_handle" &&
              dragAction.elementId === element.id
            ) {
              const nextEndPt = planeCoordsToPoint3D(
                dragAction.currentPointMm.x,
                dragAction.currentPointMm.y,
                plane,
                dragAction.thirdCoordMm
              );
              if (dragAction.endpoint === "start") start3D = nextEndPt;
              else end3D = nextEndPt;
            }

            const start2D = projectPoint3DToPlane2D(start3D, plane);
            const end2D = projectPoint3DToPlane2D(end3D, plane);
            const s = worldToScreen(start2D);
            const e = worldToScreen(end2D);

            const projectedPx = Math.hypot(e.x - s.x, e.y - s.y);
            const strokeWidthPx = Math.max(3.5, ((profile?.widthMm ?? 40) * scale) / 1.35);

            // Реальная длина в 3D пространстве (X, Y, Z)
            const lengthMm = roundMm(getElementLengthMm({ start: start3D, end: end3D }));
            const mid3D = getElementMidpoint({ start: start3D, end: end3D });
            const midScreen = worldToScreen(projectPoint3DToPlane2D(mid3D, plane));

            const beamColor =
              activeTool === "delete" && isHovered
                ? "#dc2626"
                : displaySettings.showProfileColors
                  ? (element.color ?? profile?.color ?? palette.beamFallback)
                  : palette.beamFallback;

            const isVerticalToView = projectedPx < 3 && lengthMm >= 1;
            const showLengthBadge =
              gridSettings.showDimensions &&
              lengthMm >= 1 &&
              (projectedPx >= 24 || isSelected);

            const labelText = `${lengthMm} мм`;
            const labelWidth = Math.max(52, labelText.length * 6.4 + 12);

            return (
              <Group key={element.id}>
                {(isSelected || isHovered) && !isVerticalToView && (
                  <Line
                    points={[s.x, s.y, e.x, e.y]}
                    stroke={palette.selectionHighlight}
                    opacity={isSelected ? 0.78 : 0.28}
                    strokeWidth={strokeWidthPx + 4}
                    lineCap="butt"
                  />
                )}

                {isVerticalToView ? (
                  <Group>
                    {isSelected && (
                      <Circle
                        x={s.x}
                        y={s.y}
                        radius={Math.max(8, strokeWidthPx * 0.9)}
                        stroke={palette.selectionHighlight}
                        strokeWidth={2}
                      />
                    )}
                    <Rect
                      x={s.x - Math.max(4, strokeWidthPx * 0.55)}
                      y={s.y - Math.max(4, strokeWidthPx * 0.55)}
                      width={Math.max(8, strokeWidthPx * 1.1)}
                      height={Math.max(8, strokeWidthPx * 1.1)}
                      cornerRadius={2}
                      fill={beamColor}
                      stroke={isSelected ? palette.selectionHighlight : palette.beamCenterline}
                      strokeWidth={1.2}
                    />
                  </Group>
                ) : (
                  <>
                    <Line
                      points={[s.x, s.y, e.x, e.y]}
                      stroke={beamColor}
                      strokeWidth={strokeWidthPx}
                      lineCap="butt"
                    />
                    <Line
                      points={[s.x, s.y, e.x, e.y]}
                      stroke={palette.beamCenterline}
                      strokeWidth={1}
                      dash={[4, 3]}
                      opacity={0.55}
                    />
                  </>
                )}

                {showLengthBadge && (
                  <Group
                    x={midScreen.x}
                    y={isVerticalToView ? midScreen.y - 18 : midScreen.y - 14}
                  >
                    <Rect
                      x={-labelWidth / 2}
                      y={-8}
                      width={labelWidth}
                      height={15}
                      cornerRadius={3}
                      fill={palette.badgeBg}
                      stroke={
                        isSelected
                          ? palette.badgeSelectedBorder
                          : element.groupId
                            ? palette.previewStroke
                            : palette.badgeBorder
                      }
                      strokeWidth={0.9}
                      opacity={0.94}
                    />
                    <Text
                      x={-labelWidth / 2}
                      y={-5}
                      width={labelWidth}
                      align="center"
                      text={labelText}
                      fontSize={9.5}
                      fontFamily="monospace"
                      fill={palette.badgeText}
                    />
                  </Group>
                )}
              </Group>
            );
          })}

          {/* Превью копирования (Ctrl/Alt/Copy) */}
          {dragAction?.kind === "move" &&
            dragAction.copyMode &&
            elements
              .filter((el) => dragAction.targetIds.includes(el.id))
              .map((el) => {
                const delta3D = delta2DToDelta3D(
                  dragAction.deltaMm.x,
                  dragAction.deltaMm.y,
                  plane
                );
                const s = worldToScreen(
                  projectPoint3DToPlane2D(
                    {
                      x: el.start.x + delta3D.x,
                      y: el.start.y + delta3D.y,
                      z: el.start.z + delta3D.z,
                    },
                    plane
                  )
                );
                const e = worldToScreen(
                  projectPoint3DToPlane2D(
                    {
                      x: el.end.x + delta3D.x,
                      y: el.end.y + delta3D.y,
                      z: el.end.z + delta3D.z,
                    },
                    plane
                  )
                );
                return (
                  <Line
                    key={`copy-preview-${el.id}`}
                    points={[s.x, s.y, e.x, e.y]}
                    stroke={palette.previewStroke}
                    strokeWidth={4}
                    dash={[6, 4]}
                  />
                );
              })}

          {/* Ручки редактирования концов выделенных элементов */}
          {(activeTool === "select" || activeTool === "resize") &&
            elements
              .filter((el) => selectedSet.has(el.id))
              .map((el) => {
                let s3d = el.start;
                let e3d = el.end;
                if (
                  dragAction?.kind === "resize_handle" &&
                  dragAction.elementId === el.id
                ) {
                  const pt3d = planeCoordsToPoint3D(
                    dragAction.currentPointMm.x,
                    dragAction.currentPointMm.y,
                    plane,
                    dragAction.thirdCoordMm
                  );
                  if (dragAction.endpoint === "start") s3d = pt3d;
                  else e3d = pt3d;
                }
                const s = worldToScreen(projectPoint3DToPlane2D(s3d, plane));
                const e = worldToScreen(projectPoint3DToPlane2D(e3d, plane));
                return (
                  <Group key={`handles-${el.id}`}>
                    <Circle
                      x={s.x}
                      y={s.y}
                      radius={5}
                      fill={palette.previewStroke}
                      stroke={palette.selectionHighlight}
                      strokeWidth={1.6}
                    />
                    <Circle
                      x={e.x}
                      y={e.y}
                      radius={5}
                      fill={palette.previewStroke}
                      stroke={palette.selectionHighlight}
                      strokeWidth={1.6}
                    />
                  </Group>
                );
              })}

          {/* Маркеры соединений / сварных узлов */}
          {displaySettings.showJoints &&
            joints.map((joint) => {
              const p = worldToScreen(projectPoint3DToPlane2D(joint.position, plane));
              const isSelectedJoint = joint.id === selectedJointId;
              return (
                <Circle
                  key={joint.id}
                  x={p.x}
                  y={p.y}
                  radius={isSelectedJoint ? 6.5 : 4.5}
                  fill={isSelectedJoint ? palette.jointSelectedFill : palette.jointFill}
                  stroke={isSelectedJoint ? palette.previewStroke : palette.jointStroke}
                  strokeWidth={1.5}
                  onClick={(evt) => {
                    evt.cancelBubble = true;
                    onFocus();
                    selectJoint(joint.id);
                  }}
                />
              );
            })}

          {/* Подсветка пересечений */}
          {intersections.slice(0, 60).map((inter, idx) => {
            const p = worldToScreen(inter);
            return (
              <Circle
                key={`inter-${idx}`}
                x={p.x}
                y={p.y}
                radius={2.2}
                fill={palette.previewStroke}
                opacity={0.5}
                listening={false}
              />
            );
          })}
        </Layer>

        {/* Превью инструментов и привязки */}
        <Layer listening={false}>
          {/* Превью: Линия */}
          {activeTool === "line" && lineDraft && cursorPlaneMm && (() => {
            const s = worldToScreen(lineDraft.planePt);
            const e = worldToScreen(cursorPlaneMm);
            const end3D = snapInfo?.sourcePoint3D
              ? snapInfo.sourcePoint3D
              : planeCoordsToPoint3D(
                  cursorPlaneMm.x,
                  cursorPlaneMm.y,
                  plane,
                  getThirdCoord3D(lineDraft.point3D, plane)
                );
            const lenMm = roundMm(
              getElementLengthMm({ start: lineDraft.point3D, end: end3D })
            );
            const angleStr =
              snapInfo?.angleDeg !== undefined ? ` · ${snapInfo.angleDeg}°` : "";
            const text = `${lenMm} мм${angleStr}`;
            return (
              <Group>
                <Line
                  points={[s.x, s.y, e.x, e.y]}
                  stroke={palette.previewStroke}
                  strokeWidth={3}
                  dash={[8, 4]}
                />
                <Circle x={s.x} y={s.y} radius={4} fill={palette.previewStroke} />
                <Rect
                  x={(s.x + e.x) / 2 - 44}
                  y={(s.y + e.y) / 2 - 22}
                  width={88}
                  height={18}
                  cornerRadius={4}
                  fill={palette.previewFill}
                />
                <Text
                  x={(s.x + e.x) / 2 - 44}
                  y={(s.y + e.y) / 2 - 18}
                  width={88}
                  align="center"
                  text={text}
                  fontSize={10}
                  fontStyle="bold"
                  fill={palette.previewText}
                />
              </Group>
            );
          })()}

          {/* Превью: Полилиния */}
          {activeTool === "polyline" && polylineDraft.length > 0 && cursorPlaneMm && (() => {
            const last = polylineDraft[polylineDraft.length - 1];
            const s = worldToScreen(last.planePt);
            const e = worldToScreen(cursorPlaneMm);
            const end3D = snapInfo?.sourcePoint3D
              ? snapInfo.sourcePoint3D
              : planeCoordsToPoint3D(
                  cursorPlaneMm.x,
                  cursorPlaneMm.y,
                  plane,
                  getThirdCoord3D(last.point3D, plane)
                );
            const lenMm = roundMm(
              getElementLengthMm({ start: last.point3D, end: end3D })
            );
            return (
              <Group>
                <Line
                  points={[s.x, s.y, e.x, e.y]}
                  stroke={palette.previewStroke}
                  strokeWidth={3}
                  dash={[8, 4]}
                />
                {polylineDraft.map((pt, idx) => {
                  const sp = worldToScreen(pt.planePt);
                  return (
                    <Circle
                      key={`poly-pt-${idx}`}
                      x={sp.x}
                      y={sp.y}
                      radius={4}
                      fill={palette.previewStroke}
                    />
                  );
                })}
                <Rect
                  x={(s.x + e.x) / 2 - 42}
                  y={(s.y + e.y) / 2 - 22}
                  width={84}
                  height={18}
                  cornerRadius={4}
                  fill={palette.previewFill}
                />
                <Text
                  x={(s.x + e.x) / 2 - 42}
                  y={(s.y + e.y) / 2 - 18}
                  width={84}
                  align="center"
                  text={`${lenMm} мм`}
                  fontSize={10}
                  fontStyle="bold"
                  fill={palette.previewText}
                />
              </Group>
            );
          })()}

          {/* Превью: Прямоугольник */}
          {activeTool === "rectangle" && rectDraft && cursorPlaneMm && (() => {
            const p1 = worldToScreen(rectDraft.planePt);
            const p2 = worldToScreen(cursorPlaneMm);
            const minX = Math.min(p1.x, p2.x);
            const minY = Math.min(p1.y, p2.y);
            const widthPx = Math.abs(p2.x - p1.x);
            const heightPx = Math.abs(p2.y - p1.y);
            const wMm = roundMm(Math.abs(cursorPlaneMm.x - rectDraft.planePt.x));
            const hMm = roundMm(Math.abs(cursorPlaneMm.y - rectDraft.planePt.y));

            return (
              <Group>
                <Rect
                  x={minX}
                  y={minY}
                  width={widthPx}
                  height={heightPx}
                  stroke={palette.previewStroke}
                  strokeWidth={2.5}
                  dash={[6, 4]}
                  fill={palette.marqueeFill}
                />
                <Rect
                  x={minX + widthPx / 2 - 58}
                  y={minY - 22}
                  width={116}
                  height={18}
                  cornerRadius={4}
                  fill={palette.previewFill}
                />
                <Text
                  x={minX + widthPx / 2 - 58}
                  y={minY - 18}
                  width={116}
                  align="center"
                  text={`${wMm} × ${hMm} мм`}
                  fontSize={10}
                  fontStyle="bold"
                  fill={palette.previewText}
                />
              </Group>
            );
          })()}

          {/* Рамка множественного выделения */}
          {dragAction?.kind === "marquee" && (() => {
            const p1 = worldToScreen(dragAction.startWorldMm);
            const p2 = worldToScreen(dragAction.currentWorldMm);
            return (
              <Rect
                x={Math.min(p1.x, p2.x)}
                y={Math.min(p1.y, p2.y)}
                width={Math.abs(p2.x - p1.x)}
                height={Math.abs(p2.y - p1.y)}
                stroke={palette.previewStroke}
                strokeWidth={1.2}
                dash={[4, 3]}
                fill={palette.marqueeFill}
              />
            );
          })()}

          {/* Индикатор активной привязки */}
          {snapInfo &&
            snapInfo.snapType !== "none" &&
            (isFocused || Boolean(dragAction)) && (() => {
              const p = worldToScreen(snapInfo.point);
              const color =
                snapInfo.snapType === "endpoint"
                  ? "#22c55e"
                  : snapInfo.snapType === "intersection"
                    ? palette.previewStroke
                    : snapInfo.snapType === "angle"
                      ? "#a855f7"
                      : palette.gridText;
              return (
                <Group>
                  <Circle
                    x={p.x}
                    y={p.y}
                    radius={6}
                    stroke={color}
                    strokeWidth={1.6}
                    dash={[2, 2]}
                  />
                  <Circle x={p.x} y={p.y} radius={2.5} fill={color} />
                </Group>
              );
            })()}
        </Layer>
      </Stage>

      {/* Нижняя строка состояния вида */}
      <div className="pointer-events-none absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between gap-2 text-[11px]">
        <div className="rounded border border-[var(--mc-border)] bg-[var(--mc-bg-panel)]/95 px-2 py-0.5 text-[var(--mc-text-muted)] shadow-md tabular-nums">
          <span className="text-[var(--mc-text)]">{axisCoordText}</span>
          {snapInfo?.snapType === "endpoint" && (
            <span className="ml-1.5 font-medium text-[var(--mc-success-text)]">· Вершина 3D</span>
          )}
          {snapInfo?.snapType === "intersection" && (
            <span className="ml-1.5 font-medium text-[var(--mc-brand-inline)]">· Пересечение</span>
          )}
          {snapInfo?.snapType === "angle" && (
            <span className="ml-1.5 font-medium text-[var(--mc-warning-text)]">
              · {snapInfo.angleDeg}°
            </span>
          )}
        </div>

        {dragAction?.kind === "move" && (
          <div className="rounded border border-[var(--mc-brand-border)] bg-[var(--mc-brand-soft)] px-2 py-0.5 font-medium text-[var(--mc-text)] shadow-md tabular-nums">
            {dragAction.copyMode ? "Копирование: " : "Сдвиг: "}
            {getPreviewOffsetLabel(dragAction.deltaMm, plane)}
          </div>
        )}
      </div>
    </div>
  );
});
