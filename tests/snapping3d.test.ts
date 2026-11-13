import { describe, expect, it } from "vitest";
import { DEFAULT_GRID_SETTINGS } from "@/features/projects/defaults";
import { getElementLengthMm, roundMm } from "@/lib/geometry/elements";
import {
  delta2DToDelta3D,
  getSnapPointOnPlane,
  planeCoordsToPoint3D,
  projectPoint3DToPlane2D,
} from "@/lib/geometry/snapping";
import {
  buildRectangleSegments3D,
  snapAxisDeltaMm,
  snapPoint3D,
} from "@/lib/geometry/snapping3d";
import type { ConstructionElement } from "@/types";

const sampleElements: ConstructionElement[] = [
  {
    id: "post-1",
    type: "beam",
    start: { x: 0, y: 0, z: 0 },
    end: { x: 0, y: 0, z: 2000 },
    profileId: "prof-40x40x2",
  },
];

describe("3D snapping and multi-plane construction", () => {
  it("snaps to 3D endpoints across X, Y, Z axes before grid snapping", () => {
    const res = snapPoint3D(
      { x: 25, y: 15, z: 1965 },
      sampleElements,
      DEFAULT_GRID_SETTINGS,
      "xz"
    );

    expect(res.snappedTo).toBe("endpoint");
    expect(res.point).toEqual({ x: 0, y: 0, z: 2000 });
  });

  it("snaps to minor grid step on XY, XZ and YZ work planes while preserving plane offset", () => {
    const xy = snapPoint3D(
      { x: 240, y: 560, z: 800 },
      [],
      DEFAULT_GRID_SETTINGS,
      "xy"
    );
    expect(xy.point).toEqual({ x: 200, y: 600, z: 800 });

    const xz = snapPoint3D(
      { x: 240, y: 350, z: 760 },
      [],
      DEFAULT_GRID_SETTINGS,
      "xz"
    );
    expect(xz.point).toEqual({ x: 200, y: 350, z: 800 });

    const yz = snapPoint3D(
      { x: 1200, y: 340, z: 860 },
      [],
      DEFAULT_GRID_SETTINGS,
      "yz"
    );
    expect(yz.point).toEqual({ x: 1200, y: 300, z: 900 });
  });

  it("builds closed 4-beam rectangle segments on XY, XZ and YZ planes", () => {
    const xyRect = buildRectangleSegments3D(
      { x: 0, y: 0, z: 750 },
      { x: 1200, y: 600, z: 750 },
      "xy"
    );
    expect(xyRect.length).toBe(4);
    expect(xyRect.every((seg) => seg.start.z === 750 && seg.end.z === 750)).toBe(true);

    const xzRect = buildRectangleSegments3D(
      { x: 0, y: 600, z: 0 },
      { x: 1200, y: 600, z: 2000 },
      "xz"
    );
    expect(xzRect.length).toBe(4);
    expect(xzRect.every((seg) => seg.start.y === 600 && seg.end.y === 600)).toBe(true);

    const yzRect = buildRectangleSegments3D(
      { x: 1200, y: 0, z: 0 },
      { x: 1200, y: 600, z: 2000 },
      "yz"
    );
    expect(yzRect.length).toBe(4);
    expect(yzRect.every((seg) => seg.start.x === 1200 && seg.end.x === 1200)).toBe(true);
  });

  it("snaps axis gizmo delta to grid or allows smooth 1mm precision when bypassed", () => {
    expect(snapAxisDeltaMm(243, DEFAULT_GRID_SETTINGS, false)).toBe(200);
    expect(snapAxisDeltaMm(243, DEFAULT_GRID_SETTINGS, true)).toBe(243);
  });

  it("projects 3D points cleanly to XY, XZ, YZ planes and converts deltas back to 3D", () => {
    const pt = { x: 1200, y: 600, z: 2000 };
    expect(projectPoint3DToPlane2D(pt, "xy")).toEqual({ x: 1200, y: 600 });
    expect(projectPoint3DToPlane2D(pt, "xz")).toEqual({ x: 1200, y: 2000 });
    expect(projectPoint3DToPlane2D(pt, "yz")).toEqual({ x: 600, y: 2000 });

    expect(planeCoordsToPoint3D(1200, 2000, "xz", 600)).toEqual(pt);
    expect(planeCoordsToPoint3D(600, 2000, "yz", 1200)).toEqual(pt);

    expect(delta2DToDelta3D(100, -200, "xz")).toEqual({ x: 100, y: 0, z: -200 });
    expect(delta2DToDelta3D(150, 300, "yz")).toEqual({ x: 0, y: 150, z: 300 });
  });

  it("computes true 3D element length across all 3 axes rather than flat 2D projection length", () => {
    const slopedBrace: ConstructionElement = {
      id: "brace-1",
      type: "beam",
      start: { x: 0, y: 0, z: 0 },
      end: { x: 1000, y: 0, z: 1000 },
      profileId: "prof-40x40x2",
    };

    const projStart = projectPoint3DToPlane2D(slopedBrace.start, "xy");
    const projEnd = projectPoint3DToPlane2D(slopedBrace.end, "xy");
    const flatProjectionMm = Math.hypot(projEnd.x - projStart.x, projEnd.y - projStart.y);
    const realLengthMm = roundMm(getElementLengthMm(slopedBrace));

    expect(flatProjectionMm).toBe(1000);
    expect(realLengthMm).toBe(1414.21);
  });

  it("preserves exact 3D endpoint depth when snapping on orthogonal 2D viewports", () => {
    const snapXZ = getSnapPointOnPlane(
      { x: 15, y: 1985 },
      sampleElements,
      DEFAULT_GRID_SETTINGS,
      "xz",
      { preferredThirdCoordMm: 0 }
    );
    expect(snapXZ.snapType).toBe("endpoint");
    expect(snapXZ.point).toEqual({ x: 0, y: 2000 });
    expect(snapXZ.sourcePoint3D).toEqual({ x: 0, y: 0, z: 2000 });

    const snapXYTop = getSnapPointOnPlane(
      { x: 10, y: 10 },
      sampleElements,
      DEFAULT_GRID_SETTINGS,
      "xy",
      { preferredThirdCoordMm: 2000 }
    );
    expect(snapXYTop.snapType).toBe("endpoint");
    expect(snapXYTop.sourcePoint3D).toEqual({ x: 0, y: 0, z: 2000 });
  });
});
