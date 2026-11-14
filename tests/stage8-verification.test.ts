import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET as getProfilesRoute, PUT as putProfilesRoute } from "@/app/api/profiles/route";
import { GET as getProjectsRoute, POST as postProjectRoute } from "@/app/api/projects/route";
import {
  DELETE as deleteProjectRoute,
  GET as getProjectByIdRoute,
  PATCH as patchProjectRoute,
  PUT as putProjectByIdRoute,
} from "@/app/api/projects/[id]/route";
import { POST as exportExcelRoute } from "@/app/api/export/excel/route";
import { POST as exportPdfRoute } from "@/app/api/export/pdf/route";
import { detectProjectJoints } from "@/features/joints/detectJoints";
import { EXAMPLE_PROFILES } from "@/features/profiles/defaults";
import { createEmptyProject, createExampleProject } from "@/features/projects/defaults";
import { calculateProjectEstimate, roundMoney } from "@/lib/calculations/estimate";
import { issueSessionForUser, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { resetDatabaseForTests } from "@/lib/db/sqlite";
import { upsertOAuthUser } from "@/lib/db/usersRepository";
import { generateExcelBuffer } from "@/lib/export/excelGenerator";
import { generatePdfBuffer } from "@/lib/export/pdfGenerator";
import { computeBeamTransform3D } from "@/lib/geometry/beam3d";
import { getElementLengthMm } from "@/lib/geometry/elements";
import { useProjectStore } from "@/store/useProjectStore";
import type { ConstructionElement, JointConnection, MetalCalcProject } from "@/types";

describe("Stage 8: Geometry, Calculation Accuracy, API Persistence & Performance", () => {
  beforeEach(() => {
    process.env.METALCALC_DB_PATH = ":memory:";
    resetDatabaseForTests();
    useProjectStore.getState().loadExampleProject();
  });

  afterEach(() => {
    resetDatabaseForTests();
    delete process.env.METALCALC_DB_PATH;
  });

  it("maintains 2D/3D geometry synchronization, group cleanup, and Undo/Redo consistency", () => {
    const store = useProjectStore.getState();
    store.createNewProject("Тест геометрии");

    const id1 = useProjectStore
      .getState()
      .addElement({ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }, EXAMPLE_PROFILES[0].id);
    const id2 = useProjectStore
      .getState()
      .addElement({ x: 1000, y: 0, z: 0 }, { x: 1000, y: 0, z: 2000 }, EXAMPLE_PROFILES[0].id);

    // Проверка точной 3D-длины и согласованности с 3D-трансформацией балки
    const elements = useProjectStore.getState().project.elements;
    const beam1 = elements.find((e) => e.id === id1)!;
    const beam2 = elements.find((e) => e.id === id2)!;
    expect(getElementLengthMm(beam1)).toBe(1000);
    expect(getElementLengthMm(beam2)).toBe(2000);

    const transform2 = computeBeamTransform3D(beam2.start, beam2.end);
    expect(transform2.lengthMeters).toBeCloseTo(2, 5);
    expect(transform2.position).toEqual([1, 1, 0]); // x=1м, y_scene(height Z)=1м, z_scene(Y)=0

    // Группировка, обнаружение стыка и удаление с очисткой группы и стыка
    useProjectStore.getState().selectMultipleElements([id1, id2]);
    const groupId = useProjectStore.getState().groupSelectedElements();
    expect(groupId).not.toBeNull();
    expect(useProjectStore.getState().detectAndSyncJoints()).toBe(1);

    useProjectStore.getState().resizeElementLength(id1, 1500);
    const resized = useProjectStore.getState().project.elements.find((e) => e.id === id1)!;
    expect(getElementLengthMm(resized)).toBe(1500);

    // Удаление одного элемента должно очистить группу (< 2 элементов) и связанный стык
    useProjectStore.getState().deleteElements([id2]);
    expect(useProjectStore.getState().project.elements.length).toBe(1);
    expect(useProjectStore.getState().project.groups.length).toBe(0);
    expect(useProjectStore.getState().project.joints.length).toBe(0);

    // Undo восстанавливает удалённый элемент, группу и стык
    useProjectStore.getState().undo();
    expect(useProjectStore.getState().project.elements.length).toBe(2);
    expect(useProjectStore.getState().project.groups.length).toBe(1);
    expect(useProjectStore.getState().project.joints.length).toBe(1);

    useProjectStore.getState().redo();
    expect(useProjectStore.getState().project.elements.length).toBe(1);
  });

  it("calculates metal, partial painting, both weld modes and floating-point money without drift", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);

    const profiles = [
      {
        ...EXAMPLE_PROFILES[0],
        id: "p-frac",
        pricePerMeter: 333.33,
      },
    ];

    const elements: ConstructionElement[] = [
      {
        id: "e1",
        type: "beam",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1500, y: 0, z: 0 }, // 1.5 м
        profileId: "p-frac",
      },
      {
        id: "e2",
        type: "beam",
        start: { x: 1500, y: 0, z: 0 },
        end: { x: 1500, y: 500, z: 0 }, // 0.5 м, без покраски
        profileId: "p-frac",
        excludeFromPainting: true,
      },
    ];

    const joints: JointConnection[] = [
      {
        id: "j1",
        type: "miter_90",
        elementIds: ["e1", "e2"],
        position: { x: 1500, y: 0, z: 0 },
        weldLengthMm: 250,
      },
      {
        id: "j2",
        type: "butt",
        elementIds: ["e1", "e2"],
        position: { x: 0, y: 0, z: 0 },
        weldLengthMm: null, // неизвестная длина шва
      },
    ];

    const perMeterEstimate = calculateProjectEstimate(elements, profiles, joints, {
      currency: "RUB",
      paintingPricePerMeter: 110.5,
      weldPricingMode: "per_meter",
      weldPricePerMeter: 700,
      weldPricePerJoint: 200,
    });

    expect(perMeterEstimate.totalLengthMeters).toBe(2);
    expect(perMeterEstimate.paintableLengthMeters).toBe(1.5);
    expect(perMeterEstimate.metalCost).toBe(666.66);
    expect(perMeterEstimate.paintingCost).toBe(165.75);
    expect(perMeterEstimate.knownWeldLengthMeters).toBe(0.25);
    expect(perMeterEstimate.hasUnknownWeldLength).toBe(true);
    expect(perMeterEstimate.weldingCost).toBe(175); // 0.25 * 700
    expect(perMeterEstimate.totalCost).toBe(roundMoney(666.66 + 165.75 + 175));

    const perJointEstimate = calculateProjectEstimate(elements, profiles, joints, {
      currency: "USD",
      paintingPricePerMeter: 110.5,
      weldPricingMode: "per_joint",
      weldPricePerMeter: 700,
      weldPricePerJoint: 200,
    });

    expect(perJointEstimate.weldingCost).toBe(400); // 2 * 200
    expect(perJointEstimate.currency).toBe("USD");
  });

  it("handles full SQLite API lifecycle, validation errors, and Excel/PDF API routes", async () => {
    // 0. Без сессии API проектов защищено (401)
    const unauthRes = await getProjectsRoute(new Request("http://localhost/api/projects"));
    expect(unauthRes.status).toBe(401);

    const testUser = upsertOAuthUser({
      provider: "yandex",
      providerUserId: "stage8-tester",
      email: "stage8@metalcalc.local",
      emailVerified: true,
      name: "Stage8 Tester",
    });
    const session = issueSessionForUser(testUser.id, true);
    const authCookie = `${SESSION_COOKIE_NAME}=${session.rawToken}`;

    // 1. GET /api/projects (персональный auto-seeded example)
    const listRes = await getProjectsRoute(
      new Request("http://localhost/api/projects", {
        headers: { cookie: authCookie },
      })
    );
    expect(listRes.status).toBe(200);
    const listData = (await listRes.json()) as { projects: Array<{ id: string }> };
    expect(listData.projects.length).toBe(1);

    // 2. POST /api/projects invalid payload -> 400
    const invalidRes = await postProjectRoute(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: authCookie },
        body: JSON.stringify({ broken: true }),
      })
    );
    expect(invalidRes.status).toBe(400);

    // 3. POST /api/projects valid -> 201
    const custom = createEmptyProject("Ферма 6м API");
    custom.id = "proj-api-test";
    const createRes = await postProjectRoute(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json", cookie: authCookie },
        body: JSON.stringify(custom),
      })
    );
    expect(createRes.status).toBe(201);

    // 4. PUT /api/projects/[id] & PATCH rename/duplicate & GET 404
    custom.elements.push({
      id: "el-api-1",
      type: "beam",
      start: { x: 0, y: 0, z: 0 },
      end: { x: 3000, y: 0, z: 0 },
      profileId: custom.profiles[0].id,
    });

    const putRes = await putProjectByIdRoute(
      new Request(`http://localhost/api/projects/${custom.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: authCookie },
        body: JSON.stringify(custom),
      }),
      { params: Promise.resolve({ id: custom.id }) }
    );
    expect(putRes.status).toBe(200);

    const renameRes = await patchProjectRoute(
      new Request(`http://localhost/api/projects/${custom.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: authCookie },
        body: JSON.stringify({ action: "rename", name: "Ферма 6м Переименована" }),
      }),
      { params: Promise.resolve({ id: custom.id }) }
    );
    expect(renameRes.status).toBe(200);
    const renamedBody = (await renameRes.json()) as { project: MetalCalcProject };
    expect(renamedBody.project.name).toBe("Ферма 6м Переименована");

    const dupRes = await patchProjectRoute(
      new Request(`http://localhost/api/projects/${custom.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", cookie: authCookie },
        body: JSON.stringify({ action: "duplicate" }),
      }),
      { params: Promise.resolve({ id: custom.id }) }
    );
    expect(dupRes.status).toBe(201);

    // 5. PUT & GET /api/profiles
    const profilesPutRes = await putProfilesRoute(
      new Request("http://localhost/api/profiles", {
        method: "PUT",
        headers: { "Content-Type": "application/json", cookie: authCookie },
        body: JSON.stringify({ profiles: EXAMPLE_PROFILES }),
      })
    );
    expect(profilesPutRes.status).toBe(200);
    const profilesGetRes = await getProfilesRoute(
      new Request("http://localhost/api/profiles", {
        headers: { cookie: authCookie },
      })
    );
    expect(profilesGetRes.status).toBe(200);

    // 6. Export Excel & PDF via Route Handlers
    const excelRes = await exportExcelRoute(
      new Request("http://localhost/api/export/excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: renamedBody.project }),
      })
    );
    expect(excelRes.status).toBe(200);
    expect(excelRes.headers.get("content-type")).toContain("spreadsheetml.sheet");
    expect((await excelRes.arrayBuffer()).byteLength).toBeGreaterThan(1000);

    const pdfRes = await exportPdfRoute(
      new Request("http://localhost/api/export/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: renamedBody.project }),
      })
    );
    expect(pdfRes.status).toBe(200);
    expect(pdfRes.headers.get("content-type")).toBe("application/pdf");
    const pdfBytes = new Uint8Array(await pdfRes.arrayBuffer());
    expect(Buffer.from(pdfBytes.subarray(0, 5)).toString("ascii")).toBe("%PDF-");

    // 7. DELETE & 404 verification
    const delRes = await deleteProjectRoute(
      new Request(`http://localhost/api/projects/${custom.id}`, {
        method: "DELETE",
        headers: { cookie: authCookie },
      }),
      { params: Promise.resolve({ id: custom.id }) }
    );
    expect(delRes.status).toBe(200);

    const missingRes = await getProjectByIdRoute(
      new Request(`http://localhost/api/projects/${custom.id}`, {
        headers: { cookie: authCookie },
      }),
      { params: Promise.resolve({ id: custom.id }) }
    );
    expect(missingRes.status).toBe(404);
  });

  it("processes 600 elements (estimate, joint detection, 3D transforms, Excel & PDF) within interactive bounds", async () => {
    const heavy = createExampleProject();
    heavy.id = "proj-stress-600";
    heavy.name = "Стресс-тест 600 элементов";
    heavy.elements = [];
    heavy.joints = [];

    // Строим сетку из 600 состыкованных стержней (20x15 ячеек по 500мм)
    let count = 0;
    for (let row = 0; row < 20 && count < 600; row++) {
      for (let col = 0; col < 15 && count < 600; col++) {
        const x = col * 500;
        const y = row * 500;
        heavy.elements.push({
          id: `h-${count++}`,
          type: "beam",
          start: { x, y, z: 0 },
          end: { x: x + 500, y, z: 0 },
          profileId: heavy.profiles[count % heavy.profiles.length].id,
        });
        if (count < 600) {
          heavy.elements.push({
            id: `v-${count++}`,
            type: "beam",
            start: { x, y, z: 0 },
            end: { x, y: y + 500, z: 0 },
            profileId: heavy.profiles[count % heavy.profiles.length].id,
          });
        }
      }
    }

    const t0 = performance.now();
    const detected = detectProjectJoints(heavy.elements, []);
    heavy.joints = detected;
    const estimate = calculateProjectEstimate(
      heavy.elements,
      heavy.profiles,
      heavy.joints,
      heavy.calculationSettings
    );
    const transforms = heavy.elements.map((el) => computeBeamTransform3D(el.start, el.end));
    const coreMs = performance.now() - t0;

    expect(heavy.elements.length).toBe(600);
    expect(detected.length).toBeGreaterThan(200);
    expect(estimate.totalLengthMeters).toBe(300);
    expect(transforms.length).toBe(600);
    expect(coreMs).toBeLessThan(1500);

    const tExport = performance.now();
    const [xlsxBuf, pdfBuf] = await Promise.all([
      generateExcelBuffer(heavy),
      generatePdfBuffer(heavy),
    ]);
    const exportMs = performance.now() - tExport;

    expect(xlsxBuf.length).toBeGreaterThan(5000);
    expect(pdfBuf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(exportMs).toBeLessThan(5000);
  });
});
