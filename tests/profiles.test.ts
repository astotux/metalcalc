import { describe, expect, it } from "vitest";
import { calculateProjectEstimate } from "@/lib/calculations/estimate";
import { profileFormSchema } from "@/lib/validation/schemas";
import { useProjectStore } from "@/store/useProjectStore";

describe("Валидация и управление каталогом профилей", () => {
  it("проверяет геометрическую корректность толщины стенки и цены", () => {
    const valid = profileFormSchema.safeParse({
      name: "Профиль 60×40×2",
      shapeType: "rectangular_tube",
      widthMm: 60,
      heightMm: 40,
      wallThicknessMm: 2,
      pricePerMeter: 520,
      color: "#38bdf8",
    });
    expect(valid.success).toBe(true);

    const invalidWall = profileFormSchema.safeParse({
      name: "Слишком толстая стенка",
      shapeType: "square_tube",
      widthMm: 20,
      heightMm: 20,
      wallThicknessMm: 10,
      pricePerMeter: 200,
      color: "#38bdf8",
    });
    expect(invalidWall.success).toBe(false);

    const invalidPrice = profileFormSchema.safeParse({
      name: "Отрицательная цена",
      shapeType: "square_tube",
      widthMm: 40,
      heightMm: 40,
      wallThicknessMm: 2,
      pricePerMeter: -10,
      color: "#38bdf8",
    });
    expect(invalidPrice.success).toBe(false);
  });

  it("создаёт, редактирует и защищает используемые профили от удаления", () => {
    const store = useProjectStore.getState();
    store.loadExampleProject();

    const initial = useProjectStore.getState().project;
    const usedProfileId = initial.elements[0].profileId;

    // Нельзя удалить профиль, который используется в конструкции
    const deleteUsedResult = useProjectStore.getState().deleteProfile(usedProfileId);
    expect(deleteUsedResult.ok).toBe(false);

    // Создаём новый профиль
    const newId = useProjectStore.getState().addProfile({
      name: "Профиль 50×50×3",
      shapeType: "square_tube",
      widthMm: 50,
      heightMm: 50,
      wallThicknessMm: 3,
      pricePerMeter: 600,
      color: "#22d3ee",
    });

    // Назначаем новому элементу / заменяем профиль в проекте и проверяем, что геометрия не потеряна
    const beforeCount = useProjectStore.getState().project.elements.length;
    const beforeStart = { ...useProjectStore.getState().project.elements[0].start };
    useProjectStore.getState().replaceProfileInProject(usedProfileId, newId);

    const updatedProject = useProjectStore.getState().project;
    expect(updatedProject.elements.length).toBe(beforeCount);
    expect(updatedProject.elements[0].start).toEqual(beforeStart);
    expect(updatedProject.elements[0].profileId).toBe(newId);

    // Теперь старый профиль не используется и может быть удалён
    const deleteOldResult = useProjectStore.getState().deleteProfile(usedProfileId);
    expect(deleteOldResult.ok).toBe(true);

    // Изменение цены профиля сразу отражается в смете
    const estimateBefore = calculateProjectEstimate(
      useProjectStore.getState().project.elements,
      useProjectStore.getState().project.profiles,
      useProjectStore.getState().project.joints,
      useProjectStore.getState().project.calculationSettings
    );
    useProjectStore.getState().updateProfile(newId, { pricePerMeter: 1200 });
    const estimateAfter = calculateProjectEstimate(
      useProjectStore.getState().project.elements,
      useProjectStore.getState().project.profiles,
      useProjectStore.getState().project.joints,
      useProjectStore.getState().project.calculationSettings
    );
    expect(estimateAfter.metalCost).toBeGreaterThan(estimateBefore.metalCost);
  });
});
