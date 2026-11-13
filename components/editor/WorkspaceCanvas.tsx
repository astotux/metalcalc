"use client";

import { useRef, useState } from "react";
import { Compass, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { getElementLengthMm, getElementMidpoint, roundMm } from "@/lib/geometry/elements";
import { useProjectStore } from "@/store/useProjectStore";
import type { CameraPreset, Point3D } from "@/types";

const BASE_PX_PER_MM = 0.4;

const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: "isometric", label: "Изометрия" },
  { id: "top", label: "Сверху" },
  { id: "front", label: "Спереди" },
  { id: "side", label: "Сбоку" },
];

/** Проецирует 3D-координаты (мм) в 2D-координаты экрана для предварительного 3D-вида этапа 1. */
function project3DToScreen(
  point: Point3D,
  preset: CameraPreset
): { x: number; y: number } {
  switch (preset) {
    case "top":
      return { x: point.x, y: point.y };
    case "front":
      return { x: point.x, y: -point.z };
    case "side":
      return { x: point.y, y: -point.z };
    case "isometric":
    default: {
      const cos30 = 0.8660254;
      const sin30 = 0.5;
      return {
        x: (point.x - point.y) * cos30,
        y: (point.x + point.y) * sin30 - point.z,
      };
    }
  }
}

export function WorkspaceCanvas() {
  const project = useProjectStore((s) => s.project);
  const activeTool = useProjectStore((s) => s.activeTool);
  const selectedElementIds = useProjectStore((s) => s.selectedElementIds);

  const selectElement = useProjectStore((s) => s.selectElement);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const deleteElements = useProjectStore((s) => s.deleteElements);
  const setZoomPercent = useProjectStore((s) => s.setZoomPercent);
  const setCameraPreset = useProjectStore((s) => s.setCameraPreset);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [panPx, setPanPx] = useState({ x: 180, y: 160 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cursorMm, setCursorMm] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const { viewMode, zoomPercent, cameraPreset } = project.displaySettings;
  const { majorStepMm, minorStepMm, showGrid, showAxes, showDimensions } =
    project.gridSettings;

  const scale = BASE_PX_PER_MM * (zoomPercent / 100);
  const profileMap = new Map(project.profiles.map((p) => [p.id, p]));

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 10 : -10;
    setZoomPercent(zoomPercent + delta);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    // Панорамирование средней кнопкой или левой кнопкой по пустому фону
    if (e.button === 1 || e.target === svgRef.current) {
      if (e.button === 0 && e.target === svgRef.current) {
        clearSelection();
      }
      setIsPanning(true);
      setDragStart({ x: e.clientX - panPx.x, y: e.clientY - panPx.y });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const worldX = (e.clientX - rect.left - panPx.x) / scale;
      const worldY = (e.clientY - rect.top - panPx.y) / scale;
      setCursorMm({ x: Math.round(worldX), y: Math.round(worldY) });
    }

    if (isPanning) {
      setPanPx({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handlePointerUp = () => {
    setIsPanning(false);
  };

  const resetViewport = () => {
    setZoomPercent(100);
    setPanPx({ x: 180, y: 160 });
  };

  const handleElementClick = (e: React.MouseEvent, elementId: string) => {
    e.stopPropagation();
    if (activeTool === "delete") {
      deleteElements([elementId]);
      return;
    }
    selectElement(elementId, e.shiftKey);
  };

  const minorPx = Math.max(8, minorStepMm * scale);
  const majorPx = Math.max(16, majorStepMm * scale);
  const patternOffsetX = ((panPx.x % majorPx) + majorPx) % majorPx;
  const patternOffsetY = ((panPx.y % majorPx) + majorPx) % majorPx;

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-[#121417]">
      {/* Плавающая панель управления видом и масштабом */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded border border-[#2c313a] bg-[#181b20]/95 px-2.5 py-1 text-[11px] text-[#9aa2b1] shadow-md">
          <span className="font-medium text-[#e6e8ec]">
            {viewMode === "2d" ? "Рабочая область 2D (мм)" : "Визуализация 3D (единая модель)"}
          </span>
          <span className="text-[#4a5260]">|</span>
          <span className="tabular-nums">
            X: {cursorMm.x} мм, Y: {cursorMm.y} мм
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {viewMode === "3d" && (
            <div className="flex items-center rounded border border-[#2c313a] bg-[#181b20]/95 p-0.5 shadow-md">
              <Compass className="mx-1.5 h-3.5 w-3.5 text-[#9aa2b1]" />
              {CAMERA_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setCameraPreset(preset.id)}
                  className={`rounded px-2 py-1 text-[11px] transition-colors ${
                    cameraPreset === preset.id
                      ? "bg-blue-600 text-white"
                      : "text-[#9aa2b1] hover:text-white"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

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
              onClick={resetViewport}
              className="rounded p-1 text-[#c7cdd8] hover:bg-[#252a33]"
              title="Сбросить вид"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Интерактивный вьюпорт единой модели конструкции */}
      <svg
        ref={svgRef}
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className={`h-full w-full select-none ${isPanning ? "cursor-grabbing" : "cursor-crosshair"}`}
      >
        <defs>
          <pattern
            id="cad-minor-grid"
            width={minorPx}
            height={minorPx}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${panPx.x}, ${panPx.y})`}
          >
            <path
              d={`M ${minorPx} 0 L 0 0 0 ${minorPx}`}
              fill="none"
              stroke="#1d2128"
              strokeWidth="1"
            />
          </pattern>
          <pattern
            id="cad-major-grid"
            width={majorPx}
            height={majorPx}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${patternOffsetX}, ${patternOffsetY})`}
          >
            <path
              d={`M ${majorPx} 0 L 0 0 0 ${majorPx}`}
              fill="none"
              stroke="#282d37"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        {/* Сетка координат */}
        {showGrid && viewMode === "2d" && (
          <>
            <rect width="100%" height="100%" fill="url(#cad-minor-grid)" pointerEvents="none" />
            <rect width="100%" height="100%" fill="url(#cad-major-grid)" pointerEvents="none" />
          </>
        )}

        {/* Слой геометрии */}
        <g transform={`translate(${panPx.x}, ${panPx.y})`}>
          {/* Оси координат */}
          {showAxes && (
            <g pointerEvents="none">
              <line x1={-4000} y1={0} x2={4000} y2={0} stroke="#7f1d1d" strokeWidth={1.2} />
              <line x1={0} y1={-4000} x2={0} y2={4000} stroke="#14532d" strokeWidth={1.2} />
              <circle cx={0} cy={0} r={3.5} fill="#60a5fa" />
              <text x={8} y={-6} fill="#9aa2b1" fontSize="10">
                0,0
              </text>
            </g>
          )}

          {/* Элементы конструкции */}
          {project.elements.map((element) => {
            const profile = profileMap.get(element.profileId);
            const color = element.color ?? profile?.color ?? "#38bdf8";
            const isSelected = selectedElementIds.includes(element.id);
            const lengthMm = roundMm(getElementLengthMm(element));

            const p1 =
              viewMode === "2d"
                ? { x: element.start.x, y: element.start.y }
                : project3DToScreen(element.start, cameraPreset);
            const p2 =
              viewMode === "2d"
                ? { x: element.end.x, y: element.end.y }
                : project3DToScreen(element.end, cameraPreset);

            const sx = p1.x * scale;
            const sy = p1.y * scale;
            const ex = p2.x * scale;
            const ey = p2.y * scale;

            const strokeWidthPx = Math.max(
              4,
              ((profile?.widthMm ?? 40) * scale) / (viewMode === "3d" ? 1.1 : 1.5)
            );

            const mid = getElementMidpoint(element);
            const midProjected =
              viewMode === "2d"
                ? { x: mid.x, y: mid.y }
                : project3DToScreen(mid, cameraPreset);

            return (
              <g
                key={element.id}
                onClick={(e) => handleElementClick(e, element.id)}
                className="cursor-pointer"
              >
                {/* Контур выделения */}
                {isSelected && (
                  <line
                    x1={sx}
                    y1={sy}
                    x2={ex}
                    y2={ey}
                    stroke="#ffffff"
                    strokeWidth={strokeWidthPx + 4}
                    strokeLinecap="butt"
                    opacity={0.7}
                  />
                )}

                {/* Основное тело профиля */}
                <line
                  x1={sx}
                  y1={sy}
                  x2={ex}
                  y2={ey}
                  stroke={color}
                  strokeWidth={strokeWidthPx}
                  strokeLinecap="butt"
                />

                {/* Осевая линия элемента */}
                <line
                  x1={sx}
                  y1={sy}
                  x2={ex}
                  y2={ey}
                  stroke="#0b0d10"
                  strokeWidth={1}
                  strokeDasharray="4 3"
                  opacity={0.55}
                />

                {/* Подпись размера в миллиметрах */}
                {showDimensions && (
                  <g
                    transform={`translate(${midProjected.x * scale}, ${midProjected.y * scale - 10})`}
                    pointerEvents="none"
                  >
                    <rect
                      x={-26}
                      y={-10}
                      width={52}
                      height={15}
                      rx={3}
                      fill="#141619"
                      fillOpacity={0.85}
                      stroke="#2c313a"
                      strokeWidth={0.75}
                    />
                    <text
                      x={0}
                      y={0.5}
                      textAnchor="middle"
                      fill="#e6e8ec"
                      fontSize="9.5"
                      fontFamily="monospace"
                    >
                      {lengthMm} мм
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Узлы соединений */}
          {project.displaySettings.showJoints &&
            project.joints.map((joint) => {
              const p =
                viewMode === "2d"
                  ? { x: joint.position.x, y: joint.position.y }
                  : project3DToScreen(joint.position, cameraPreset);
              return (
                <circle
                  key={joint.id}
                  cx={p.x * scale}
                  cy={p.y * scale}
                  r={4}
                  fill="#fbbf24"
                  stroke="#141619"
                  strokeWidth={1.5}
                  pointerEvents="none"
                />
              );
            })}
        </g>
      </svg>

      {/* Нижняя подсказка в рабочей области */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-[#2c313a] bg-[#181b20]/90 px-2.5 py-1 text-[11px] text-[#9aa2b1]">
        {project.elements.length === 0
          ? "Конструкция пуста. Добавьте элемент по координатам в левой панели или откройте пример проекта."
          : "Клик по элементу — выбор и редактирование. Перетаскивание по фону — сдвиг вида. Колёсико — масштаб."}
      </div>
    </main>
  );
}
