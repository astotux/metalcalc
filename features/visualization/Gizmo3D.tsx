"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { modelPointToScene } from "@/lib/geometry/beam3d";
import { snapAxisDeltaMm } from "@/lib/geometry/snapping3d";
import type { GridSettings, Point3D } from "@/types";

export type AxisKey = "x" | "y" | "z";

function applyViewportCursor(cursor: string): void {
  if (typeof document !== "undefined") {
    document.body.style.cursor = cursor;
  }
}

interface GizmoAxisConfig {
  axis: AxisKey;
  color: string;
  hoverColor: string;
  dirScene: THREE.Vector3;
  rotation: [number, number, number];
}

// Стрелка по умолчанию вытянута вдоль +Y в локальных координатах цилиндра/конуса
const AXIS_CONFIGS: GizmoAxisConfig[] = [
  {
    axis: "x",
    color: "#ef4444",
    hoverColor: "#fca5a5",
    dirScene: new THREE.Vector3(1, 0, 0),
    rotation: [0, 0, -Math.PI / 2],
  },
  {
    axis: "y",
    color: "#22c55e",
    hoverColor: "#86efac",
    dirScene: new THREE.Vector3(0, 0, 1),
    rotation: [Math.PI / 2, 0, 0],
  },
  {
    axis: "z",
    color: "#3b82f6",
    hoverColor: "#93c5fd",
    dirScene: new THREE.Vector3(0, 1, 0),
    rotation: [0, 0, 0],
  },
];

interface Gizmo3DProps {
  anchorMm: Point3D;
  gridSettings: GridSettings;
  onDragActiveChange: (active: boolean) => void;
  onDragPreview: (deltaMm: Point3D, activeAxis: AxisKey) => void;
  onDragCommit: (deltaMm: Point3D) => void;
}

export function Gizmo3D({
  anchorMm,
  gridSettings,
  onDragActiveChange,
  onDragPreview,
  onDragCommit,
}: Gizmo3DProps) {
  const { camera, gl } = useThree();
  const groupRef = useRef<THREE.Group | null>(null);
  const [hoveredAxis, setHoveredAxis] = useState<AxisKey | null>(null);
  const [draggingAxis, setDraggingAxis] = useState<AxisKey | null>(null);

  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    applyViewportCursor(draggingAxis ? "grabbing" : hoveredAxis ? "grab" : "default");
    return () => applyViewportCursor("default");
  }, [draggingAxis, hoveredAxis]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const anchorScene = modelPointToScene(anchorMm);

  // Поддерживаем постоянный удобный экранный размер гизмо независимо от зума
  useFrame(() => {
    if (!groupRef.current) return;
    const distance = camera.position.distanceTo(groupRef.current.position);
    const scale = Math.max(0.28, Math.min(1.5, distance * 0.16));
    groupRef.current.scale.setScalar(scale);
  });

  const handleAxisPointerDown = (config: GizmoAxisConfig, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    cleanupRef.current?.();

    const axisDir = config.dirScene.clone().normalize();
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);

    // Строим плоскость, содержащую ось и максимально развёрнутую к камере
    const planeNormal = camDir
      .clone()
      .sub(axisDir.clone().multiplyScalar(camDir.dot(axisDir)));
    if (planeNormal.lengthSq() < 1e-4) {
      planeNormal.crossVectors(axisDir, new THREE.Vector3(0, 1, 0));
      if (planeNormal.lengthSq() < 1e-4) {
        planeNormal.crossVectors(axisDir, new THREE.Vector3(1, 0, 0));
      }
    }
    planeNormal.normalize();

    const dragPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      planeNormal,
      anchorScene
    );

    const raycaster = new THREE.Raycaster();
    const startHit = new THREE.Vector3();
    if (!e.ray.intersectPlane(dragPlane, startHit)) {
      startHit.copy(anchorScene);
    }

    let latestDelta: Point3D = { x: 0, y: 0, z: 0 };
    setDraggingAxis(config.axis);
    onDragActiveChange(true);

    const computeDeltaFromPointer = (clientX: number, clientY: number, altKey: boolean): Point3D => {
      const rect = gl.domElement.getBoundingClientRect();
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);

      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(dragPlane, hit)) {
        return latestDelta;
      }

      const rawMeters = hit.clone().sub(startHit).dot(axisDir);
      const snappedMm = snapAxisDeltaMm(rawMeters * 1000, gridSettings, altKey);
      return {
        x: config.axis === "x" ? snappedMm : 0,
        y: config.axis === "y" ? snappedMm : 0,
        z: config.axis === "z" ? snappedMm : 0,
      };
    };

    const handleMove = (ev: PointerEvent) => {
      latestDelta = computeDeltaFromPointer(ev.clientX, ev.clientY, ev.altKey);
      onDragPreview(latestDelta, config.axis);
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      cleanupRef.current = null;
      setDraggingAxis(null);
      onDragActiveChange(false);
      onDragCommit(latestDelta);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    cleanupRef.current = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      onDragActiveChange(false);
    };
  };

  return (
    <group ref={groupRef} position={[anchorScene.x, anchorScene.y, anchorScene.z]}>
      {/* Центральная сфера якоря */}
      <mesh>
        <sphereGeometry args={[0.04, 14, 14]} />
        <meshStandardMaterial color="#f8fafc" emissive="#475569" emissiveIntensity={0.4} />
      </mesh>

      {AXIS_CONFIGS.map((cfg) => {
        const isActive = draggingAxis === cfg.axis || hoveredAxis === cfg.axis;
        const activeColor = isActive ? cfg.hoverColor : cfg.color;

        return (
          <group key={cfg.axis} rotation={cfg.rotation}>
            {/* Невидимая широкая зона захвата стрелки для лёгкого попадания мышью */}
            <mesh
              position={[0, 0.55, 0]}
              onPointerDown={(e) => handleAxisPointerDown(cfg, e)}
              onPointerOver={(e) => {
                e.stopPropagation();
                setHoveredAxis(cfg.axis);
              }}
              onPointerOut={() => {
                setHoveredAxis(null);
              }}
            >
              <cylinderGeometry args={[0.09, 0.09, 1.1, 8]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Видимый стержень оси */}
            <mesh position={[0, 0.45, 0]} raycast={() => null}>
              <cylinderGeometry args={[isActive ? 0.022 : 0.015, isActive ? 0.022 : 0.015, 0.9, 12]} />
              <meshBasicMaterial color={activeColor} depthTest={false} />
            </mesh>

            {/* Наконечник стрелки */}
            <mesh position={[0, 0.98, 0]} raycast={() => null}>
              <coneGeometry args={[isActive ? 0.065 : 0.05, 0.18, 16]} />
              <meshBasicMaterial color={activeColor} depthTest={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
