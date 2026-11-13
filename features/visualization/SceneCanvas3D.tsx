"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Grid, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Compass, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { BeamMesh3D } from "@/features/visualization/BeamMesh3D";
import {
  computeConstructionBounds3D,
  getCameraPoseForPreset,
  modelPointToScene,
} from "@/lib/geometry/beam3d";
import { useProjectStore } from "@/store/useProjectStore";
import type { CameraPreset } from "@/types";

const CAMERA_PRESETS: { id: CameraPreset; label: string }[] = [
  { id: "isometric", label: "Изометрия" },
  { id: "top", label: "Сверху" },
  { id: "front", label: "Спереди" },
  { id: "side", label: "Сбоку" },
];

interface CameraControllerProps {
  preset: CameraPreset;
  resetSignal: number;
  zoomStepSignal: { dir: -1 | 1; seq: number } | null;
  center: [number, number, number];
  radiusMeters: number;
}

function CameraController({
  preset,
  resetSignal,
  zoomStepSignal,
  center,
  radiusMeters,
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
    // Перемещаем камеру при смене пресета или явном сбросе
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, resetSignal]);

  useEffect(() => {
    if (!zoomStepSignal || !controlsRef.current) return;
    const target = controlsRef.current.target;
    const offset = camera.position.clone().sub(target);
    const factor = zoomStepSignal.dir > 0 ? 0.8 : 1.25;
    offset.multiplyScalar(factor);
    // Ограничиваем слишком близкий или слишком далёкий зум
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
      enableDamping
      dampingFactor={0.08}
      minDistance={0.25}
      maxDistance={40}
    />
  );
}

export default function SceneCanvas3D() {
  const project = useProjectStore((s) => s.project);
  const selectedElementIds = useProjectStore((s) => s.selectedElementIds);
  const selectedJointId = useProjectStore((s) => s.selectedJointId);

  const selectElement = useProjectStore((s) => s.selectElement);
  const selectJoint = useProjectStore((s) => s.selectJoint);
  const clearSelection = useProjectStore((s) => s.clearSelection);
  const setCameraPreset = useProjectStore((s) => s.setCameraPreset);

  const resetSeqRef = useRef(0);
  const zoomSeqRef = useRef<{ dir: -1 | 1; seq: number } | null>(null);
  const resetCounter = useRef(0);
  const [resetSignal, setResetSignal] = useState(0);
  const [zoomSignal, setZoomSignal] = useState<{ dir: -1 | 1; seq: number } | null>(null);

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

  const triggerReset = () => {
    resetCounter.current += 1;
    resetSeqRef.current = resetCounter.current;
    setResetSignal(resetCounter.current);
  };

  const triggerZoom = (dir: -1 | 1) => {
    const nextSeq = (zoomSeqRef.current?.seq ?? 0) + 1;
    const next = { dir, seq: nextSeq };
    zoomSeqRef.current = next;
    setZoomSignal(next);
  };

  return (
    <div className="relative flex-1 overflow-hidden bg-[#121417]">
      {/* Плавающая панель управления 3D-камерой */}
      <div className="pointer-events-none absolute left-3 right-3 top-3 z-10 flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2 rounded border border-[#2c313a] bg-[#181b20]/95 px-2.5 py-1 text-[11px] text-[#9aa2b1] shadow-md">
          <span className="font-medium text-[#e6e8ec]">3D Визуализация (Three.js)</span>
          <span className="text-[#4a5260]">|</span>
          <span>Элементов: {project.elements.length}</span>
        </div>

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

      {/* 3D Canvas */}
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 42, near: 0.05, far: 100, position: [2.4, 1.8, 2.4] }}
        onPointerMissed={() => clearSelection()}
      >
        <color attach="background" args={["#121417"]} />

        {/* Студийное освещение */}
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
        />

        {/* Координатная сетка в метрах */}
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

        {/* Оси координат (X — красная, Y/вверх — синяя, Z/2D-Y — зелёная) */}
        {showAxes && <axesHelper args={[0.8]} />}

        {/* Профильные трубы единой модели */}
        {project.elements.map((element) => (
          <BeamMesh3D
            key={element.id}
            element={element}
            profile={profileMap.get(element.profileId)}
            isSelected={selectedElementIds.includes(element.id)}
            onSelect={selectElement}
          />
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

      {/* Подсказка по управлению камерой */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-[#2c313a] bg-[#181b20]/90 px-2.5 py-1 text-[11px] text-[#9aa2b1]">
        ЛКМ + перетаскивание — вращение · ПКМ — перемещение · Колёсико — приближение · Клик по трубе — свойства.
      </div>
    </div>
  );
}
