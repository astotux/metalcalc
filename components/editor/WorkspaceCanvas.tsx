"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { Compass, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { getElementLengthMm, getElementMidpoint, roundMm } from "@/lib/geometry/elements";
import { useProjectStore } from "@/store/useProjectStore";
import type { CameraPreset, Point3D } from "@/types";

const KonvaCanvas2D = dynamic(() => import("@/features/drawing/KonvaCanvas2D"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center bg-[#121417] text-xs text-[#9aa2b1]">
      Загрузка 2D-редактора...
    </div>
  ),
});

const BASE_PX_PER_MM = 0.4;

const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: "isometric", label: "Изометрия" },
  { id: "top", label: "Сверху" },
  { id: "front", label: "Спереди" },
  { id: "side", label: "Сбоку" },
];

/** Проецирует 3D-координаты (мм) в 2D-координаты экрана для предварительного 3D-вида. */
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

function Preview3DCanvas() {
  const project = useProjectStore((s) => s.project);
  const selectedElementIds = useProjectStore((s) => s.selectedElementIds);
  const selectElement = useProjectStore((s) => s.selectElement);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const setZoomPercent = useProjectStore((s) => s.setZoomPercent);
  const setCameraPreset = useProjectStore((s) => s.setCameraPreset);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [panPx, setPanPx] = useState({ x: 260, y: 180 });
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const { zoomPercent, cameraPreset } = project.displaySettings;
  const { showAxes, showDimensions } = project.gridSettings;
  const scale = BASE_PX_PER_MM * (zoomPercent / 100);
  const profileMap = new Map(project.profiles.map((p) => [p.id, p]));

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden bg-[#121417]">
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded border border-[#2c313a] bg-[#181b20]/95 px-2.5 py-1 text-[11px] text-[#9aa2b1] shadow-md">
          <span className="font-medium text-[#e6e8ec]">Предпросмотр 3D (единая модель)</span>
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
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
              onClick={() => {
                setZoomPercent(100);
                setPanPx({ x: 260, y: 180 });
              }}
              className="rounded p-1 text-[#c7cdd8] hover:bg-[#252a33]"
              title="Сбросить вид"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      <svg
        ref={svgRef}
        onWheel={(e) => {
          e.preventDefault();
          setZoomPercent(zoomPercent + (e.deltaY < 0 ? 10 : -10));
        }}
        onPointerDown={(e) => {
          if (e.button === 1 || e.target === svgRef.current) {
            if (e.button === 0 && e.target === svgRef.current) clearSelection();
            setIsPanning(true);
            setDragStart({ x: e.clientX - panPx.x, y: e.clientY - panPx.y });
          }
        }}
        onPointerMove={(e) => {
          if (isPanning) {
            setPanPx({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
          }
        }}
        onPointerUp={() => setIsPanning(false)}
        onPointerLeave={() => setIsPanning(false)}
        className={`h-full w-full select-none ${isPanning ? "cursor-grabbing" : "cursor-default"}`}
      >
        <g transform={`translate(${panPx.x}, ${panPx.y})`}>
          {showAxes && (
            <g pointerEvents="none">
              <line x1={-4000} y1={0} x2={4000} y2={0} stroke="#7f1d1d" strokeWidth={1.2} />
              <line x1={0} y1={-4000} x2={0} y2={4000} stroke="#14532d" strokeWidth={1.2} />
              <circle cx={0} cy={0} r={3.5} fill="#60a5fa" />
            </g>
          )}

          {project.elements.map((element) => {
            const profile = profileMap.get(element.profileId);
            const color = element.color ?? profile?.color ?? "#38bdf8";
            const isSelected = selectedElementIds.includes(element.id);
            const lengthMm = roundMm(getElementLengthMm(element));
            const p1 = project3DToScreen(element.start, cameraPreset);
            const p2 = project3DToScreen(element.end, cameraPreset);
            const midProjected = project3DToScreen(getElementMidpoint(element), cameraPreset);
            const strokeWidthPx = Math.max(4, ((profile?.widthMm ?? 40) * scale) / 1.1);

            return (
              <g
                key={element.id}
                onClick={(e) => {
                  e.stopPropagation();
                  selectElement(element.id, e.shiftKey);
                }}
                className="cursor-pointer"
              >
                {isSelected && (
                  <line
                    x1={p1.x * scale}
                    y1={p1.y * scale}
                    x2={p2.x * scale}
                    y2={p2.y * scale}
                    stroke="#ffffff"
                    strokeWidth={strokeWidthPx + 4}
                    opacity={0.7}
                  />
                )}
                <line
                  x1={p1.x * scale}
                  y1={p1.y * scale}
                  x2={p2.x * scale}
                  y2={p2.y * scale}
                  stroke={color}
                  strokeWidth={strokeWidthPx}
                />
                {showDimensions && (
                  <text
                    x={midProjected.x * scale}
                    y={midProjected.y * scale - 10}
                    textAnchor="middle"
                    fill="#e6e8ec"
                    fontSize="10"
                    fontFamily="monospace"
                    pointerEvents="none"
                  >
                    {lengthMm} мм
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </main>
  );
}

export function WorkspaceCanvas() {
  const viewMode = useProjectStore((s) => s.project.displaySettings.viewMode);
  if (viewMode === "2d") {
    return <KonvaCanvas2D />;
  }
  return <Preview3DCanvas />;
}
