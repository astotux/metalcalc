"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, Line, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Compass, Layers, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { BeamMesh3D } from "@/features/visualization/BeamMesh3D";
import { Gizmo3D, type AxisKey } from "@/features/visualization/Gizmo3D";
import {
  computeConstructionBounds3D,
  getCameraPoseForPreset,
  MM_TO_SCENE,
  modelPointToScene,
} from "@/lib/geometry/beam3d";
import { getElementLengthMm, roundMm } from "@/lib/geometry/elements";
import {
  buildRectangleSegments3D,
  snapPoint3D,
  type Snap3DSource,
  type WorkPlane3D,
} from "@/lib/geometry/snapping3d";
import { useProjectStore } from "@/store/useProjectStore";
import type { CameraPreset, ConstructionElement, Point3D } from "@/types";

const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: "isometric", label: "Изометрия" },
  { id: "top", label: "Сверху" },
  { id: "front", label: "Спереди" },
  { id: "side", label: "Сбоку" },
];

const WORK_PLANES: { id: WorkPlane3D; label: string; axisLabel: string }[] = [
  { id: "xy", label: "XY (пол)", axisLabel: "Z" },
  { id: "xz", label: "XZ (фасад)", axisLabel: "Y" },
  { id: "yz", label: "YZ (торец)", axisLabel: "X" },
];

type ManipulateTarget = "whole" | "start" | "end";

interface CameraControllerProps {
  preset: CameraPreset;
  resetSignal: number;
  zoomStepSignal: { dir: -1 | 1; seq: number } | null;
  center: [number, number, number];
  radiusMeters: number;
  orbitEnabled: boolean;
}

function CameraController({
  preset,
  resetSignal,
  zoomStepSignal,
  center,
  radiusMeters,
  orbitEnabled,
}: CameraControllerProps) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    const pose = getCameraPoseForPreset(preset, center, radiusMeters);
    camera.position.set(...pose.position);
    if (controlsRef.current) {
      controlsRef.current.target.set(...pose.target);
      controlsRef.current.update();
    } else {
      camera.lookAt(...pose.target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, resetSignal]);

  useEffect(() => {
    if (!zoomStepSignal || !controlsRef.current) return;
    const target = controlsRef.current.target;
    const offset = camera.position.clone().sub(target);
    const factor = zoomStepSignal.dir > 0 ? 0.8 : 1.25;
    offset.multiplyScalar(factor);
    const len = offset.length();
    if (len >= 0.3 && len <= 40) {
      camera.position.copy(target).add(offset);
      controlsRef.current.update();
    }
  }, [zoomStepSignal, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={orbitEnabled}
      enableDamping
      dampingFactor={0.08}
      minDistance={0.25}
      maxDistance={40}
    />
  );
}

function scenePointToModelMm(vec: THREE.Vector3, plane: WorkPlane3D, offsetMm: number): Point3D {
  const x = roundMm(vec.x / MM_TO_SCENE);
  const y = roundMm(vec.z / MM_TO_SCENE);
  const z = roundMm(vec.y / MM_TO_SCENE);

  if (plane === "xy") return { x, y, z: roundMm(offsetMm) };
  if (plane === "xz") return { x, y: roundMm(offsetMm), z };
  return { x: roundMm(offsetMm), y, z };
}

function getPlaneTransform(
  plane: WorkPlane3D,
  offsetMm: number
): { position: [number, number, number]; rotation: [number, number, number] } {
  const offsetMeters = offsetMm * MM_TO_SCENE;
  switch (plane) {
    case "xz":
      return {
        position: [0, 0, offsetMeters],
        rotation: [0, 0, 0],
      };
    case "yz":
      return {
        position: [offsetMeters, 0, 0],
        rotation: [0, Math.PI / 2, 0],
      };
    case "xy":
    default:
      return {
        position: [0, offsetMeters, 0],
        rotation: [-Math.PI / 2, 0, 0],
      };
  }
}

function addDelta(p: Point3D, delta: Point3D): Point3D {
  return {
    x: roundMm(p.x + delta.x),
    y: roundMm(p.y + delta.y),
    z: roundMm(p.z + delta.z),
  };
}

export default function SceneCanvas3D() {
  const project = useProjectStore((s) => s.project);
  const activeTool = useProjectStore((s) => s.activeTool);
  const activeProfileId = useProjectStore((s) => s.activeProfileId);
  const selectedElementIds = useProjectStore((s) => s.selectedElementIds);
  const selectedJointId = useProjectStore((s) => s.selectedJointId);

  const selectElement = useProjectStore((s) => s.selectElement);
  const selectJoint = useProjectStore((s) => s.selectJoint);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const setCameraPreset = useProjectStore((s) => s.setCameraPreset);
  const moveElements = useProjectStore((s) => s.moveElements);
  const setElementEndpoints = useProjectStore((s) => s.setElementEndpoints);
  const addElement = useProjectStore((s) => s.addElement);
  const addElementsBatch = useProjectStore((s) => s.addElementsBatch);
  const deleteElements = useProjectStore((s) => s.deleteElements);
  const duplicateElement = useProjectStore((s) => s.duplicateElement);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  const resetCounter = useRef(0);
  const zoomSeqRef = useRef<{ dir: -1 | 1; seq: number } | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [zoomSignal, setZoomSignal] = useState<{ dir: -1 | 1; seq: number } | null>(null);

  const [orbitEnabled, setOrbitEnabled] = useState(true);
  const [manipulateTarget, setManipulateTarget] = useState<ManipulateTarget>("whole");
  const [dragPreview, setDragPreview] = useState<{
    deltaMm: Point3D;
    axis: AxisKey;
  } | null>(null);

  const [workPlane, setWorkPlane] = useState<WorkPlane3D>("xy");
  const [planeOffsetMm, setPlaneOffsetMm] = useState<number>(0);
  const [drawStart, setDrawStart] = useState<Point3D | null>(null);
  const [cursor3D, setCursor3D] = useState<{
    point: Point3D;
    snappedTo: Snap3DSource;
  } | null>(null);

  const isDrawingTool =
    activeTool === "line" || activeTool === "rectangle" || activeTool === "polyline";

  // Горячие клавиши 3D-редактора
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
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

      if (e.key === "Escape") {
        if (drawStart) {
          setDrawStart(null);
        } else {
          clearSelection();
        }
        return;
      }

      if (e.key === "Enter" && activeTool === "polyline" && drawStart) {
        setDrawStart(null);
        return;
      }

      if ((e.key === "Delete" || e.key === "Backspace") && selectedElementIds.length > 0) {
        e.preventDefault();
        deleteElements(selectedElementIds);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTool, clearSelection, deleteElements, drawStart, redo, selectedElementIds, undo]);

  const profileMap = useMemo(
    () => new Map(project.profiles.map((p) => [p.id, p])),
    [project.profiles]
  );

  const bounds = useMemo(
    () => computeConstructionBounds3D(project.elements),
    [project.elements]
  );

  const { cameraPreset, showJoints } = project.displaySettings;
  const { showGrid, showAxes, majorStepMm, minorStepMm } = project.gridSettings;

  const singleSelectedElement = useMemo(() => {
    if (selectedElementIds.length !== 1) return null;
    return project.elements.find((el) => el.id === selectedElementIds[0]) ?? null;
  }, [project.elements, selectedElementIds]);

  const effectiveTarget: ManipulateTarget = singleSelectedElement ? manipulateTarget : "whole";

  // Вычисляем элементы с учётом живого предпросмотра перетаскивания гизмо
  const displayedElements = useMemo<ConstructionElement[]>(() => {
    if (!dragPreview) return project.elements;
    const selectedSet = new Set(selectedElementIds);
    return project.elements.map((el) => {
      if (!selectedSet.has(el.id)) return el;
      if (singleSelectedElement && el.id === singleSelectedElement.id) {
        if (effectiveTarget === "start") {
          return { ...el, start: addDelta(el.start, dragPreview.deltaMm) };
        }
        if (effectiveTarget === "end") {
          return { ...el, end: addDelta(el.end, dragPreview.deltaMm) };
        }
      }
      return {
        ...el,
        start: addDelta(el.start, dragPreview.deltaMm),
        end: addDelta(el.end, dragPreview.deltaMm),
      };
    });
  }, [
    dragPreview,
    effectiveTarget,
    project.elements,
    selectedElementIds,
    singleSelectedElement,
  ]);

  const displayedSelectedSet = useMemo(
    () => new Set(selectedElementIds),
    [selectedElementIds]
  );

  const displayedSingleSelected = useMemo(() => {
    if (!singleSelectedElement) return null;
    return displayedElements.find((el) => el.id === singleSelectedElement.id) ?? null;
  }, [displayedElements, singleSelectedElement]);

  // Позиция 3D-манипулятора (центр выделения или выбранная вершина)
  const gizmoAnchorMm = useMemo<Point3D | null>(() => {
    if (isDrawingTool || selectedElementIds.length === 0) return null;

    if (displayedSingleSelected) {
      if (effectiveTarget === "start") return displayedSingleSelected.start;
      if (effectiveTarget === "end") return displayedSingleSelected.end;
      return {
        x: roundMm((displayedSingleSelected.start.x + displayedSingleSelected.end.x) / 2),
        y: roundMm((displayedSingleSelected.start.y + displayedSingleSelected.end.y) / 2),
        z: roundMm((displayedSingleSelected.start.z + displayedSingleSelected.end.z) / 2),
      };
    }

    const selected = displayedElements.filter((el) => displayedSelectedSet.has(el.id));
    if (selected.length === 0) return null;
    let sx = 0;
    let sy = 0;
    let sz = 0;
    for (const el of selected) {
      sx += (el.start.x + el.end.x) / 2;
      sy += (el.start.y + el.end.y) / 2;
      sz += (el.start.z + el.end.z) / 2;
    }
    return {
      x: roundMm(sx / selected.length),
      y: roundMm(sy / selected.length),
      z: roundMm(sz / selected.length),
    };
  }, [
    displayedElements,
    displayedSelectedSet,
    displayedSingleSelected,
    effectiveTarget,
    isDrawingTool,
    selectedElementIds.length,
  ]);

  const triggerReset = () => {
    resetCounter.current += 1;
    setResetSignal(resetCounter.current);
  };

  const triggerZoom = (dir: -1 | 1) => {
    const nextSeq = (zoomSeqRef.current?.seq ?? 0) + 1;
    const next = { dir, seq: nextSeq };
    zoomSeqRef.current = next;
    setZoomSignal(next);
  };

  const handleElementAction = (elementId: string, additive: boolean) => {
    if (activeTool === "delete") {
      deleteElements([elementId]);
      return;
    }
    if (activeTool === "copy") {
      duplicateElement(elementId);
      return;
    }
    selectElement(elementId, additive);
    if (!additive) {
      setManipulateTarget("whole");
    }
  };

  const handleGizmoCommit = (deltaMm: Point3D) => {
    setDragPreview(null);
    if (Math.abs(deltaMm.x) < 0.5 && Math.abs(deltaMm.y) < 0.5 && Math.abs(deltaMm.z) < 0.5) {
      return;
    }

    if (singleSelectedElement && effectiveTarget !== "whole") {
      const nextStart =
        effectiveTarget === "start"
          ? addDelta(singleSelectedElement.start, deltaMm)
          : singleSelectedElement.start;
      const nextEnd =
        effectiveTarget === "end"
          ? addDelta(singleSelectedElement.end, deltaMm)
          : singleSelectedElement.end;

      if (Math.hypot(nextEnd.x - nextStart.x, nextEnd.y - nextStart.y, nextEnd.z - nextStart.z) >= 1) {
        setElementEndpoints(singleSelectedElement.id, nextStart, nextEnd);
      }
      return;
    }

    moveElements(selectedElementIds, deltaMm);
  };

  const commitDrawPoint = (point: Point3D) => {
    if (!drawStart) {
      setDrawStart(point);
      return;
    }

    if (activeTool === "line") {
      if (
        Math.hypot(point.x - drawStart.x, point.y - drawStart.y, point.z - drawStart.z) >= 1
      ) {
        addElement(drawStart, point, activeProfileId);
      }
      setDrawStart(null);
      return;
    }

    if (activeTool === "polyline") {
      if (
        Math.hypot(point.x - drawStart.x, point.y - drawStart.y, point.z - drawStart.z) >= 1
      ) {
        addElement(drawStart, point, activeProfileId);
        setDrawStart(point);
      }
      return;
    }

    if (activeTool === "rectangle") {
      const segments = buildRectangleSegments3D(drawStart, point, workPlane);
      if (segments.length > 0) {
        addElementsBatch(
          segments.map((seg) => ({
            start: seg.start,
            end: seg.end,
            profileId: activeProfileId,
          }))
        );
      }
      setDrawStart(null);
    }
  };

  const handleAdoptLevelFromSelection = () => {
    if (!singleSelectedElement) return;
    if (workPlane === "xy") setPlaneOffsetMm(singleSelectedElement.start.z);
    else if (workPlane === "xz") setPlaneOffsetMm(singleSelectedElement.start.y);
    else setPlaneOffsetMm(singleSelectedElement.start.x);
  };

  // Предпросмотр строящихся линий в 3D
  const previewSegments = useMemo<Array<[THREE.Vector3, THREE.Vector3]>>(() => {
    if (!isDrawingTool || !drawStart || !cursor3D) return [];
    if (activeTool === "rectangle") {
      return buildRectangleSegments3D(drawStart, cursor3D.point, workPlane).map((seg) => [
        modelPointToScene(seg.start),
        modelPointToScene(seg.end),
      ]);
    }
    return [[modelPointToScene(drawStart), modelPointToScene(cursor3D.point)]];
  }, [activeTool, cursor3D, drawStart, isDrawingTool, workPlane]);

  const planeTransform = useMemo(
    () => getPlaneTransform(workPlane, planeOffsetMm),
    [workPlane, planeOffsetMm]
  );

  const activePlaneMeta = WORK_PLANES.find((p) => p.id === workPlane) ?? WORK_PLANES[0];
  const stepMm = Math.max(10, minorStepMm || 100);

  return (
    <div className="relative flex-1 overflow-hidden bg-[#121417]">
      {/* Плавающая верхняя панель 3D-редактора */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-wrap items-start justify-between gap-2">
        <div className="pointer-events-auto flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2 rounded border border-[#2c313a] bg-[#181b20]/95 px-2.5 py-1 text-[11px] text-[#9aa2b1] shadow-md">
            <span className="font-medium text-[#e6e8ec]">3D Редактор (X / Y / Z)</span>
            <span className="text-[#4a5260]">|</span>
            <span>Элементов: {project.elements.length}</span>
            {displayedSingleSelected && (
              <>
                <span className="text-[#4a5260]">|</span>
                <span className="tabular-nums text-blue-300">
                  Длина: {roundMm(getElementLengthMm(displayedSingleSelected))} мм
                </span>
              </>
            )}
          </div>

          {/* Выбор цели 3D-манипулятора для одиночной трубы */}
          {singleSelectedElement && !isDrawingTool && (
            <div className="flex items-center gap-1 rounded border border-[#2c313a] bg-[#181b20]/95 p-1 text-[11px] shadow-md">
              <span className="px-1.5 text-[#9aa2b1]">Оси X/Y/Z:</span>
              {(
                [
                  { id: "whole", label: "Весь элемент" },
                  { id: "start", label: "Начало" },
                  { id: "end", label: "Конец" },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setManipulateTarget(mode.id)}
                  className={`rounded px-2 py-0.5 transition-colors ${
                    effectiveTarget === mode.id
                      ? "bg-blue-600 text-white"
                      : "text-[#9aa2b1] hover:bg-[#252a33] hover:text-white"
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          )}

          {/* Панель рабочей плоскости для рисования в 3D */}
          {isDrawingTool && (
            <div className="flex flex-wrap items-center gap-1.5 rounded border border-blue-500/40 bg-[#181b20]/95 px-2 py-1 text-[11px] shadow-md">
              <Layers className="h-3.5 w-3.5 text-blue-400" />
              <div className="flex items-center gap-0.5 rounded bg-[#121417] p-0.5">
                {WORK_PLANES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setWorkPlane(p.id);
                      setDrawStart(null);
                    }}
                    className={`rounded px-1.5 py-0.5 transition-colors ${
                      workPlane === p.id
                        ? "bg-blue-600 text-white"
                        : "text-[#9aa2b1] hover:text-white"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <span className="text-[#9aa2b1]">{activePlaneMeta.axisLabel}=</span>
              <button
                type="button"
                onClick={() => setPlaneOffsetMm((v) => v - stepMm)}
                className="rounded border border-[#343a46] bg-[#22262d] px-1.5 py-0.5 text-[#e6e8ec] hover:bg-[#2c313a]"
                title={`Сдвинуть плоскость на -${stepMm} мм`}
              >
                −
              </button>
              <input
                type="number"
                step={stepMm}
                value={planeOffsetMm}
                onChange={(e) => setPlaneOffsetMm(Number(e.target.value) || 0)}
                className="w-16 rounded border border-[#2c313a] bg-[#121417] px-1.5 py-0.5 text-center tabular-nums text-white outline-none focus:border-blue-500"
              />
              <span className="text-[#6c7484]">мм</span>
              <button
                type="button"
                onClick={() => setPlaneOffsetMm((v) => v + stepMm)}
                className="rounded border border-[#343a46] bg-[#22262d] px-1.5 py-0.5 text-[#e6e8ec] hover:bg-[#2c313a]"
                title={`Сдвинуть плоскость на +${stepMm} мм`}
              >
                +
              </button>
              {singleSelectedElement && (
                <button
                  type="button"
                  onClick={handleAdoptLevelFromSelection}
                  className="rounded border border-[#343a46] bg-[#22262d] px-1.5 py-0.5 text-[10px] text-blue-300 hover:bg-[#2c313a]"
                  title="Взять уровень плоскости от выделенного элемента"
                >
                  От выдел.
                </button>
              )}
            </div>
          )}
        </div>

        {/* Управление камерой */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5">
          <div className="flex items-center rounded border border-[#2c313a] bg-[#181b20]/95 p-0.5 shadow-md">
            <Compass className="mx-1.5 h-3.5 w-3.5 text-[#9aa2b1]" />
            {CAMERA_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => {
                  setCameraPreset(preset.id);
                  triggerReset();
                }}
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
              onClick={() => triggerZoom(1)}
              className="rounded p-1 text-[#c7cdd8] hover:bg-[#252a33]"
              title="Приблизить камеру"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => triggerZoom(-1)}
              className="rounded p-1 text-[#c7cdd8] hover:bg-[#252a33]"
              title="Отдалить камеру"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={triggerReset}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-[#c7cdd8] hover:bg-[#252a33]"
              title="Сбросить камеру на центр конструкции"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Сброс</span>
            </button>
          </div>
        </div>
      </div>

      {/* Индикатор живого перетаскивания или 3D-курсора */}
      {(dragPreview || (isDrawingTool && cursor3D)) && (
        <div className="pointer-events-none absolute right-3 bottom-10 z-10 rounded border border-blue-500/40 bg-[#181b20]/95 px-2.5 py-1 text-[11px] tabular-nums text-[#e6e8ec] shadow-md">
          {dragPreview ? (
            <span>
              Сдвиг по{" "}
              <strong className="uppercase text-blue-300">{dragPreview.axis}</strong>:{" "}
              {dragPreview.deltaMm[dragPreview.axis] >= 0 ? "+" : ""}
              {dragPreview.deltaMm[dragPreview.axis]} мм{" "}
              <span className="text-[#9aa2b1]">(Alt — плавно)</span>
            </span>
          ) : (
            cursor3D && (
              <span>
                3D: X {cursor3D.point.x} · Y {cursor3D.point.y} · Z {cursor3D.point.z} мм{" "}
                <span className="text-amber-300">
                  [{cursor3D.snappedTo === "endpoint" ? "Вершина" : "Сетка"}]
                </span>
              </span>
            )
          )}
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 42, near: 0.05, far: 100, position: [2.4, 1.8, 2.4] }}
        onPointerMissed={() => {
          if (!isDrawingTool) clearSelection();
        }}
      >
        <color attach="background" args={["#121417"]} />

        <ambientLight intensity={0.65} />
        <hemisphereLight args={["#dbeafe", "#1e293b", 0.45]} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.15}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-4, 3, -5]} intensity={0.45} />

        <CameraController
          preset={cameraPreset}
          resetSignal={resetSignal}
          zoomStepSignal={zoomSignal}
          center={bounds.center}
          radiusMeters={bounds.radiusMeters}
          orbitEnabled={orbitEnabled}
        />

        {/* Базовая сетка пола в метрах */}
        {showGrid && (
          <Grid
            position={[0, -0.001, 0]}
            args={[24, 24]}
            cellSize={Math.max(0.05, minorStepMm * 0.001)}
            cellThickness={0.5}
            cellColor="#1e232b"
            sectionSize={Math.max(0.1, majorStepMm * 0.001)}
            sectionThickness={1}
            sectionColor="#333b48"
            fadeDistance={20}
            fadeStrength={1.2}
          />
        )}

        {/* Оси координат модели в начале (0,0,0): X=красный, Y(2D)=зелёный, Z(высота)=синий */}
        {showAxes && (
          <group>
            <Line points={[[0, 0, 0], [0.9, 0, 0]]} color="#ef4444" lineWidth={2} />
            <Line points={[[0, 0, 0], [0, 0, 0.9]]} color="#22c55e" lineWidth={2} />
            <Line points={[[0, 0, 0], [0, 0.9, 0]]} color="#3b82f6" lineWidth={2} />
          </group>
        )}

        {/* Интерактивная рабочая плоскость для рисования в 3D */}
        {isDrawingTool && (
          <group position={planeTransform.position} rotation={planeTransform.rotation}>
            <mesh
              onPointerMove={(e) => {
                e.stopPropagation();
                const rawModel = scenePointToModelMm(e.point, workPlane, planeOffsetMm);
                const snapped = snapPoint3D(
                  rawModel,
                  project.elements,
                  project.gridSettings,
                  workPlane,
                  drawStart ?? undefined
                );
                setCursor3D({ point: snapped.point, snappedTo: snapped.snappedTo });
              }}
              onPointerOut={() => setCursor3D(null)}
              onClick={(e) => {
                e.stopPropagation();
                const rawModel = scenePointToModelMm(e.point, workPlane, planeOffsetMm);
                const snapped = snapPoint3D(
                  rawModel,
                  project.elements,
                  project.gridSettings,
                  workPlane,
                  drawStart ?? undefined
                );
                commitDrawPoint(snapped.point);
              }}
            >
              <planeGeometry args={[28, 28]} />
              <meshBasicMaterial
                color="#2563eb"
                transparent
                opacity={workPlane === "xy" && planeOffsetMm === 0 ? 0 : 0.06}
                side={THREE.DoubleSide}
                depthWrite={false}
              />
            </mesh>
          </group>
        )}

        {/* Профильные трубы единой модели */}
        {displayedElements.map((element) => (
          <BeamMesh3D
            key={element.id}
            element={element}
            profile={profileMap.get(element.profileId)}
            isSelected={displayedSelectedSet.has(element.id)}
            onSelect={(id, additive) => {
              if (isDrawingTool) {
                if (cursor3D) commitDrawPoint(cursor3D.point);
                return;
              }
              handleElementAction(id, additive);
            }}
          />
        ))}

        {/* Сферические маркеры начала/конца одиночной выделенной трубы для точечного редактирования */}
        {displayedSingleSelected && !isDrawingTool && (
          <>
            {(
              [
                { key: "start" as const, point: displayedSingleSelected.start, color: "#06b6d4" },
                { key: "end" as const, point: displayedSingleSelected.end, color: "#f59e0b" },
              ] as const
            ).map((handle) => {
              const pos = modelPointToScene(handle.point);
              const isSelectedHandle = effectiveTarget === handle.key;
              return (
                <mesh
                  key={handle.key}
                  position={[pos.x, pos.y, pos.z]}
                  onClick={(e) => {
                    e.stopPropagation();
                    setManipulateTarget(handle.key);
                  }}
                >
                  <sphereGeometry args={[isSelectedHandle ? 0.028 : 0.02, 16, 16]} />
                  <meshStandardMaterial
                    color={isSelectedHandle ? "#ffffff" : handle.color}
                    emissive={handle.color}
                    emissiveIntensity={isSelectedHandle ? 0.7 : 0.35}
                  />
                </mesh>
              );
            })}
          </>
        )}

        {/* 3D-манипулятор осей X / Y / Z */}
        {gizmoAnchorMm && (
          <Gizmo3D
            anchorMm={gizmoAnchorMm}
            gridSettings={project.gridSettings}
            onDragActiveChange={(active) => setOrbitEnabled(!active)}
            onDragPreview={(deltaMm, axis) => setDragPreview({ deltaMm, axis })}
            onDragCommit={handleGizmoCommit}
          />
        )}

        {/* Маркер 3D-курсора привязки и предпросмотр строящихся труб */}
        {isDrawingTool && cursor3D && (
          <mesh position={modelPointToScene(cursor3D.point)} raycast={() => null}>
            <sphereGeometry args={[0.022, 14, 14]} />
            <meshBasicMaterial
              color={cursor3D.snappedTo === "endpoint" ? "#fbbf24" : "#38bdf8"}
            />
          </mesh>
        )}
        {isDrawingTool && drawStart && (
          <mesh position={modelPointToScene(drawStart)} raycast={() => null}>
            <sphereGeometry args={[0.024, 14, 14]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>
        )}
        {previewSegments.map(([pA, pB], idx) => (
          <Line key={idx} points={[pA, pB]} color="#60a5fa" lineWidth={2.5} dashed />
        ))}

        {/* Маркеры узлов соединений */}
        {showJoints &&
          project.joints.map((joint) => {
            const pos = modelPointToScene(joint.position);
            const isSelectedJoint = selectedJointId === joint.id;
            return (
              <mesh
                key={joint.id}
                position={[pos.x, pos.y, pos.z]}
                onClick={(e) => {
                  e.stopPropagation();
                  selectJoint(joint.id);
                }}
              >
                <sphereGeometry args={[isSelectedJoint ? 0.024 : 0.015, 14, 14]} />
                <meshStandardMaterial
                  color={isSelectedJoint ? "#ffffff" : "#fbbf24"}
                  emissive={isSelectedJoint ? "#3b82f6" : "#b45309"}
                  emissiveIntensity={0.5}
                />
              </mesh>
            );
          })}
      </Canvas>

      {/* Подсказка по управлению в 3D */}
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap items-center gap-2 rounded border border-[#2c313a] bg-[#181b20]/90 px-2.5 py-1 text-[11px] text-[#9aa2b1]">
        <span>
          <strong className="text-red-400">X</strong>{" "}
          <strong className="text-emerald-400">Y</strong>{" "}
          <strong className="text-blue-400">Z</strong> — стрелки для перемещения в 3D
        </span>
        <span className="text-[#4a5260]">·</span>
        <span>Клик по точке на трубе — тянуть конец · ЛКМ — вращение · ПКМ — панорама</span>
      </div>
    </div>
  );
}
