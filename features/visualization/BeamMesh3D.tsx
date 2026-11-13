"use client";

import { useEffect, useMemo, useState } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import {
  computeBeamTransform3D,
  createHollowTubeGeometry,
} from "@/lib/geometry/beam3d";
import type { ConstructionElement, MaterialProfile } from "@/types";

interface BeamMesh3DProps {
  element: ConstructionElement;
  profile: MaterialProfile | undefined;
  isSelected: boolean;
  onSelect: (elementId: string, additive: boolean) => void;
}

export function BeamMesh3D({
  element,
  profile,
  isSelected,
  onSelect,
}: BeamMesh3DProps) {
  const [hovered, setHovered] = useState(false);

  const transform = useMemo(
    () => computeBeamTransform3D(element.start, element.end),
    [element.start, element.end]
  );

  const widthMm = profile?.widthMm ?? 40;
  const heightMm = profile?.heightMm ?? 40;
  const wallThicknessMm = profile?.wallThicknessMm ?? 2;

  const geometry = useMemo(
    () =>
      createHollowTubeGeometry(
        { widthMm, heightMm, wallThicknessMm },
        transform.lengthMeters
      ),
    [widthMm, heightMm, wallThicknessMm, transform.lengthMeters]
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const baseColor = element.color ?? profile?.color ?? "#38bdf8";

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(element.id, e.shiftKey);
  };

  return (
    <mesh
      geometry={geometry}
      position={transform.position}
      quaternion={transform.quaternion}
      castShadow
      receiveShadow
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = "default";
      }}
    >
      <meshStandardMaterial
        color={baseColor}
        metalness={0.45}
        roughness={0.42}
        emissive={isSelected ? "#3b82f6" : hovered ? "#ffffff" : "#000000"}
        emissiveIntensity={isSelected ? 0.45 : hovered ? 0.14 : 0}
      />
    </mesh>
  );
}
