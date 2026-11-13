import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  computeBeamTransform3D,
  computeConstructionBounds3D,
  createHollowTubeGeometry,
  modelPointToScene,
} from "@/lib/geometry/beam3d";
import type { ConstructionElement } from "@/types";

describe("Геометрия 3D профильных труб", () => {
  it("корректно переводит координаты из миллиметров в метры 3D-сцены", () => {
    const v = modelPointToScene({ x: 1200, y: 600, z: 750 });
    expect(v.x).toBeCloseTo(1.2, 5);
    expect(v.y).toBeCloseTo(0.75, 5);
    expect(v.z).toBeCloseTo(0.6, 5);
  });

  it("вычисляет центр, длину и направление горизонтальной и вертикальной балки", () => {
    const horiz = computeBeamTransform3D({ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 });
    expect(horiz.lengthMeters).toBeCloseTo(1.0, 5);
    expect(horiz.position).toEqual([0.5, 0, 0]);

    const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(
      new THREE.Quaternion(...horiz.quaternion)
    );
    expect(localZ.x).toBeCloseTo(1, 4);
    expect(localZ.y).toBeCloseTo(0, 4);
    expect(localZ.z).toBeCloseTo(0, 4);

    const vert = computeBeamTransform3D({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 800 });
    expect(vert.lengthMeters).toBeCloseTo(0.8, 5);
    expect(vert.position[1]).toBeCloseTo(0.4, 5);
  });

  it("строит полую геометрию трубы с внешними размерами, соответствующими профилю", () => {
    const geometry = createHollowTubeGeometry(
      { widthMm: 60, heightMm: 30, wallThicknessMm: 2 },
      1.5
    );
    geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    geometry.boundingBox?.getSize(size);

    expect(size.x).toBeCloseTo(0.06, 4);
    expect(size.y).toBeCloseTo(0.03, 4);
    expect(size.z).toBeCloseTo(1.5, 4);
    geometry.dispose();
  });

  it("вычисляет центр и радиус конструкции для наведения камеры", () => {
    const elements: ConstructionElement[] = [
      {
        id: "e1",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1200, y: 600, z: 0 },
        profileId: "prof-40x40x2",
      },
    ];
    const bounds = computeConstructionBounds3D(elements);
    expect(bounds.center[0]).toBeCloseTo(0.6, 4);
    expect(bounds.center[2]).toBeCloseTo(0.3, 4);
    expect(bounds.radiusMeters).toBeGreaterThan(0.8);
  });
});
