"use client";

import { create } from "zustand";
import { createEmptyProject, createExampleProject } from "@/features/projects/defaults";
import {
  apiDeleteProject,
  apiDuplicateProject,
  apiGetProject,
  apiListProfileCatalog,
  apiListProjects,
  apiRenameProject,
  apiSaveProfileCatalog,
  apiSaveProject,
} from "@/features/projects/apiClient";
import {
  clearSavedProfileCatalog,
  loadSavedProfileCatalog,
  saveProfileCatalog,
} from "@/features/profiles/storage";
import {
  detectProjectJoints,
  estimateJointPerimeterWeldMm,
} from "@/features/joints/detectJoints";
import type { DbProjectSummary } from "@/lib/db/projectsRepository";
import { getElementLengthMm, resizeElementEndByLength, roundMm } from "@/lib/geometry/elements";
import type {
  CalculationSettings,
  CameraPreset,
  ConstructionElement,
  DrawingTool,
  ElementGroup,
  GridSettings,
  JointConnection,
  MaterialProfile,
  MetalCalcProject,
  Point2D,
  Point3D,
  SaveStatus,
  ViewMode,
} from "@/types";

const STORAGE_KEY_ACTIVE_ID = "metalcalc_active_project_id_v1";

interface HistorySnapshot {
  elements: ConstructionElement[];
  groups: ElementGroup[];
  joints: JointConnection[];
}

export type ProjectSummary = DbProjectSummary;

interface ProjectStoreState {
  project: MetalCalcProject;
  savedProjects: DbProjectSummary[];
  projectsLoading: boolean;
  hasHydrated: boolean;
  activeTool: DrawingTool;
  activeProfileId: string;
  selectedElementIds: string[];
  selectedJointId: string | null;
  saveStatus: SaveStatus;
  lastError: string | null;
  historyPast: HistorySnapshot[];
  historyFuture: HistorySnapshot[];

  // Инструменты и выделение
  setActiveTool: (tool: DrawingTool) => void;
  setActiveProfileId: (profileId: string) => void;
  selectElement: (elementId: string | null, additive?: boolean) => void;
  selectMultipleElements: (elementIds: string[], additive?: boolean) => void;
  selectJoint: (jointId: string | null) => void;
  clearSelection: () => void;

  // Вид и сетка
  setViewMode: (mode: ViewMode) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setZoomPercent: (zoomPercent: number) => void;
  setPanOffsetMm: (offsetMm: Point2D) => void;
  setShowJoints: (show: boolean) => void;
  updateGridSettings: (patch: Partial<GridSettings>) => void;

  // Операции с элементами (единая модель)
  addElement: (start: Point3D, end: Point3D, profileId?: string) => string;
  addElementsBatch: (
    items: Array<{ start: Point3D; end: Point3D; profileId?: string }>
  ) => string[];
  updateElement: (id: string, patch: Partial<ConstructionElement>) => void;
  setElementEndpoints: (id: string, start: Point3D, end: Point3D) => void;
  moveElements: (ids: string[], deltaMm: Point3D) => void;
  copyElements: (ids: string[], deltaMm: Point3D) => string[];
  resizeElementLength: (id: string, targetLengthMm: number) => void;
  deleteElements: (ids: string[]) => void;
  duplicateElement: (id: string) => string | null;
  groupSelectedElements: () => string | null;
  ungroupSelectedElements: () => void;

  // Каталог профилей
  addProfile: (profile: Omit<MaterialProfile, "id">) => string;
  updateProfile: (id: string, patch: Partial<MaterialProfile>) => void;
  deleteProfile: (id: string) => { ok: boolean; reason?: string };
  assignProfileToElements: (elementIds: string[], profileId: string) => void;
  replaceProfileInProject: (oldProfileId: string, newProfileId: string) => void;
  saveCatalogAsDefault: () => boolean;

  // Соединения и сварка
  detectAndSyncJoints: () => number;
  addManualJoint: (joint: Omit<JointConnection, "id">) => string;
  updateJoint: (id: string, patch: Partial<JointConnection>) => void;
  deleteJoint: (id: string) => void;
  estimateAllWeldLengthsByPerimeter: () => void;

  // Настройки расчёта
  updateCalculationSettings: (patch: Partial<CalculationSettings>) => void;

  // История Undo / Redo
  undo: () => void;
  redo: () => void;

  // Управление проектами (SQLite через API-маршруты Next.js)
  renameProject: (name: string) => void;
  createNewProject: (name?: string) => void;
  loadExampleProject: () => void;
  saveCurrentProject: () => Promise<boolean>;
  openProjectById: (id: string) => Promise<boolean>;
  duplicateCurrentProject: () => Promise<boolean>;
  duplicateSavedProject: (id: string) => Promise<boolean>;
  renameSavedProject: (id: string, name: string) => Promise<boolean>;
  deleteSavedProject: (id: string) => Promise<boolean>;
  fetchSavedProjects: () => Promise<DbProjectSummary[]>;
  hydrateFromStorage: () => Promise<void>;
  resetForUserSession: () => void;
}

function cloneSnapshot(project: MetalCalcProject): HistorySnapshot {
  return {
    elements: project.elements.map((el) => ({
      ...el,
      start: { ...el.start },
      end: { ...el.end },
    })),
    groups: project.groups.map((g) => ({
      ...g,
      elementIds: [...g.elementIds],
    })),
    joints: project.joints.map((j) => ({
      ...j,
      elementIds: [...j.elementIds],
      position: { ...j.position },
    })),
  };
}

/** Расширяет список выбранных элементов до полных групп, если какие-то элементы состоят в группе. */
function expandSelectionWithGroups(
  elements: ConstructionElement[],
  groups: ElementGroup[],
  ids: string[]
): string[] {
  const result = new Set(ids);
  for (const id of ids) {
    const el = elements.find((item) => item.id === id);
    if (el?.groupId) {
      const grp = groups.find((g) => g.id === el.groupId);
      grp?.elementIds.forEach((memberId) => result.add(memberId));
    }
  }
  return Array.from(result);
}

function saveActiveProjectId(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
  } catch {
    // Игнорируем ограничения доступа к localStorage
  }
}

function readActiveProjectId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
  } catch {
    return null;
  }
}

function clearActiveProjectId(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY_ACTIVE_ID);
  } catch {
    // ignore
  }
}

const initialProject = createExampleProject();

export const useProjectStore = create<ProjectStoreState>((set, get) => ({
  project: initialProject,
  savedProjects: [],
  projectsLoading: false,
  hasHydrated: false,
  activeTool: "select",
  activeProfileId: initialProject.profiles[2]?.id ?? initialProject.profiles[0]?.id ?? "",
  selectedElementIds: [],
  selectedJointId: null,
  saveStatus: "saved",
  lastError: null,
  historyPast: [],
  historyFuture: [],

  setActiveTool: (tool) => set({ activeTool: tool }),

  setActiveProfileId: (profileId) => set({ activeProfileId: profileId }),

  selectElement: (elementId, additive = false) =>
    set((state) => {
      if (!elementId) {
        return { selectedElementIds: [], selectedJointId: null };
      }
      const expanded = expandSelectionWithGroups(
        state.project.elements,
        state.project.groups,
        [elementId]
      );
      if (!additive) {
        return { selectedElementIds: expanded, selectedJointId: null };
      }
      const allPresent = expanded.every((id) => state.selectedElementIds.includes(id));
      if (allPresent) {
        const removeSet = new Set(expanded);
        return {
          selectedElementIds: state.selectedElementIds.filter((id) => !removeSet.has(id)),
          selectedJointId: null,
        };
      }
      return {
        selectedElementIds: Array.from(new Set([...state.selectedElementIds, ...expanded])),
        selectedJointId: null,
      };
    }),

  selectMultipleElements: (elementIds, additive = false) =>
    set((state) => {
      const expanded = expandSelectionWithGroups(
        state.project.elements,
        state.project.groups,
        elementIds
      );
      if (!additive) {
        return { selectedElementIds: expanded, selectedJointId: null };
      }
      return {
        selectedElementIds: Array.from(new Set([...state.selectedElementIds, ...expanded])),
        selectedJointId: null,
      };
    }),

  selectJoint: (jointId) =>
    set({
      selectedJointId: jointId,
      selectedElementIds: [],
    }),

  clearSelection: () => set({ selectedElementIds: [], selectedJointId: null }),

  setViewMode: (viewMode) =>
    set((state) => ({
      project: {
        ...state.project,
        displaySettings: { ...state.project.displaySettings, viewMode },
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    })),

  setCameraPreset: (cameraPreset) =>
    set((state) => ({
      project: {
        ...state.project,
        displaySettings: { ...state.project.displaySettings, cameraPreset },
      },
    })),

  setZoomPercent: (zoomPercent) =>
    set((state) => ({
      project: {
        ...state.project,
        displaySettings: {
          ...state.project.displaySettings,
          zoomPercent: Math.min(400, Math.max(10, Math.round(zoomPercent))),
        },
      },
    })),

  setPanOffsetMm: (panOffsetMm) =>
    set((state) => ({
      project: {
        ...state.project,
        displaySettings: {
          ...state.project.displaySettings,
          panOffsetMm: { x: panOffsetMm.x, y: panOffsetMm.y },
        },
      },
    })),

  setShowJoints: (showJoints) =>
    set((state) => ({
      project: {
        ...state.project,
        displaySettings: {
          ...state.project.displaySettings,
          showJoints,
        },
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    })),

  updateGridSettings: (patch) =>
    set((state) => ({
      project: {
        ...state.project,
        gridSettings: { ...state.project.gridSettings, ...patch },
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    })),

  addElement: (start, end, profileId) => {
    const state = get();
    const id = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const chosenProfileId =
      profileId ?? state.activeProfileId ?? state.project.profiles[0]?.id ?? "";

    const newElement: ConstructionElement = {
      id,
      type: "beam",
      start: { x: roundMm(start.x), y: roundMm(start.y), z: roundMm(start.z) },
      end: { x: roundMm(end.x), y: roundMm(end.y), z: roundMm(end.z) },
      profileId: chosenProfileId,
    };

    const snapshot = cloneSnapshot(state.project);

    set({
      project: {
        ...state.project,
        elements: [...state.project.elements, newElement],
        updatedAt: new Date().toISOString(),
      },
      selectedElementIds: [id],
      saveStatus: "unsaved",
      historyPast: [...state.historyPast.slice(-49), snapshot],
      historyFuture: [],
    });

    return id;
  },

  addElementsBatch: (items) => {
    const state = get();
    if (items.length === 0) return [];

    const snapshot = cloneSnapshot(state.project);
    const created: ConstructionElement[] = items.map((item, idx) => ({
      id: `el-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      type: "beam",
      start: { x: roundMm(item.start.x), y: roundMm(item.start.y), z: roundMm(item.start.z) },
      end: { x: roundMm(item.end.x), y: roundMm(item.end.y), z: roundMm(item.end.z) },
      profileId:
        item.profileId ?? state.activeProfileId ?? state.project.profiles[0]?.id ?? "",
    }));

    const createdIds = created.map((el) => el.id);
    set({
      project: {
        ...state.project,
        elements: [...state.project.elements, ...created],
        updatedAt: new Date().toISOString(),
      },
      selectedElementIds: createdIds,
      saveStatus: "unsaved",
      historyPast: [...state.historyPast.slice(-49), snapshot],
      historyFuture: [],
    });

    return createdIds;
  },

  updateElement: (id, patch) =>
    set((state) => {
      const target = state.project.elements.find((el) => el.id === id);
      if (!target) return state;

      const snapshot = cloneSnapshot(state.project);
      const updatedElements = state.project.elements.map((el) =>
        el.id === id
          ? {
              ...el,
              ...patch,
              start: patch.start ? { ...patch.start } : el.start,
              end: patch.end ? { ...patch.end } : el.end,
            }
          : el
      );

      return {
        project: {
          ...state.project,
          elements: updatedElements,
          updatedAt: new Date().toISOString(),
        },
        saveStatus: "unsaved",
        historyPast: [...state.historyPast.slice(-49), snapshot],
        historyFuture: [],
      };
    }),

  setElementEndpoints: (id, start, end) =>
    set((state) => {
      const target = state.project.elements.find((el) => el.id === id);
      if (!target) return state;

      const snapshot = cloneSnapshot(state.project);
      return {
        project: {
          ...state.project,
          elements: state.project.elements.map((el) =>
            el.id === id
              ? {
                  ...el,
                  start: { x: roundMm(start.x), y: roundMm(start.y), z: roundMm(start.z) },
                  end: { x: roundMm(end.x), y: roundMm(end.y), z: roundMm(end.z) },
                }
              : el
          ),
          updatedAt: new Date().toISOString(),
        },
        saveStatus: "unsaved",
        historyPast: [...state.historyPast.slice(-49), snapshot],
        historyFuture: [],
      };
    }),

  moveElements: (ids, deltaMm) =>
    set((state) => {
      if (ids.length === 0) return state;
      if (Math.abs(deltaMm.x) < 0.01 && Math.abs(deltaMm.y) < 0.01 && Math.abs(deltaMm.z) < 0.01) {
        return state;
      }

      const idSet = new Set(ids);
      const snapshot = cloneSnapshot(state.project);

      return {
        project: {
          ...state.project,
          elements: state.project.elements.map((el) =>
            idSet.has(el.id)
              ? {
                  ...el,
                  start: {
                    x: roundMm(el.start.x + deltaMm.x),
                    y: roundMm(el.start.y + deltaMm.y),
                    z: roundMm(el.start.z + deltaMm.z),
                  },
                  end: {
                    x: roundMm(el.end.x + deltaMm.x),
                    y: roundMm(el.end.y + deltaMm.y),
                    z: roundMm(el.end.z + deltaMm.z),
                  },
                }
              : el
          ),
          updatedAt: new Date().toISOString(),
        },
        saveStatus: "unsaved",
        historyPast: [...state.historyPast.slice(-49), snapshot],
        historyFuture: [],
      };
    }),

  copyElements: (ids, deltaMm) => {
    const state = get();
    const idSet = new Set(ids);
    const sources = state.project.elements.filter((el) => idSet.has(el.id));
    if (sources.length === 0) return [];

    const snapshot = cloneSnapshot(state.project);
    const copies: ConstructionElement[] = sources.map((source, idx) => ({
      ...source,
      id: `el-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      start: {
        x: roundMm(source.start.x + deltaMm.x),
        y: roundMm(source.start.y + deltaMm.y),
        z: roundMm(source.start.z + deltaMm.z),
      },
      end: {
        x: roundMm(source.end.x + deltaMm.x),
        y: roundMm(source.end.y + deltaMm.y),
        z: roundMm(source.end.z + deltaMm.z),
      },
      groupId: undefined,
      jointStartId: undefined,
      jointEndId: undefined,
    }));

    const copyIds = copies.map((c) => c.id);
    set({
      project: {
        ...state.project,
        elements: [...state.project.elements, ...copies],
        updatedAt: new Date().toISOString(),
      },
      selectedElementIds: copyIds,
      saveStatus: "unsaved",
      historyPast: [...state.historyPast.slice(-49), snapshot],
      historyFuture: [],
    });

    return copyIds;
  },

  resizeElementLength: (id, targetLengthMm) =>
    set((state) => {
      const target = state.project.elements.find((el) => el.id === id);
      if (!target || targetLengthMm <= 0) return state;

      const currentLength = getElementLengthMm(target);
      if (Math.abs(currentLength - targetLengthMm) < 0.01) return state;

      const snapshot = cloneSnapshot(state.project);
      const nextEnd = resizeElementEndByLength(target, targetLengthMm);

      return {
        project: {
          ...state.project,
          elements: state.project.elements.map((el) =>
            el.id === id ? { ...el, end: nextEnd } : el
          ),
          updatedAt: new Date().toISOString(),
        },
        saveStatus: "unsaved",
        historyPast: [...state.historyPast.slice(-49), snapshot],
        historyFuture: [],
      };
    }),

  deleteElements: (ids) =>
    set((state) => {
      if (ids.length === 0) return state;
      const idSet = new Set(ids);
      const snapshot = cloneSnapshot(state.project);
      const nextGroups = state.project.groups
        .map((g) => ({
          ...g,
          elementIds: g.elementIds.filter((elId) => !idSet.has(elId)),
        }))
        .filter((g) => g.elementIds.length >= 2);
      const validGroupIds = new Set(nextGroups.map((g) => g.id));

      return {
        project: {
          ...state.project,
          elements: state.project.elements
            .filter((el) => !idSet.has(el.id))
            .map((el) =>
              el.groupId && !validGroupIds.has(el.groupId)
                ? { ...el, groupId: undefined }
                : el
            ),
          groups: nextGroups,
          joints: state.project.joints.filter(
            (j) => !j.elementIds.some((elId) => idSet.has(elId))
          ),
          updatedAt: new Date().toISOString(),
        },
        selectedElementIds: state.selectedElementIds.filter((id) => !idSet.has(id)),
        saveStatus: "unsaved",
        historyPast: [...state.historyPast.slice(-49), snapshot],
        historyFuture: [],
      };
    }),

  duplicateElement: (id) => {
    const state = get();
    const source = state.project.elements.find((el) => el.id === id);
    if (!source) return null;

    const offsetMm = state.project.gridSettings.minorStepMm || 100;
    const newId = `el-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const copy: ConstructionElement = {
      ...source,
      id: newId,
      start: {
        x: source.start.x + offsetMm,
        y: source.start.y + offsetMm,
        z: source.start.z,
      },
      end: {
        x: source.end.x + offsetMm,
        y: source.end.y + offsetMm,
        z: source.end.z,
      },
      label: source.label ? `${source.label} (копия)` : undefined,
      jointStartId: undefined,
      jointEndId: undefined,
    };

    const snapshot = cloneSnapshot(state.project);
    set({
      project: {
        ...state.project,
        elements: [...state.project.elements, copy],
        updatedAt: new Date().toISOString(),
      },
      selectedElementIds: [newId],
      saveStatus: "unsaved",
      historyPast: [...state.historyPast.slice(-49), snapshot],
      historyFuture: [],
    });

    return newId;
  },

  groupSelectedElements: () => {
    const state = get();
    if (state.selectedElementIds.length < 2) return null;

    const groupId = `grp-${Date.now()}`;
    const selectedSet = new Set(state.selectedElementIds);
    const snapshot = cloneSnapshot(state.project);

    const newGroup: ElementGroup = {
      id: groupId,
      name: `Группа (${state.selectedElementIds.length})`,
      elementIds: [...state.selectedElementIds],
    };

    // Удаляем выделенные элементы из старых групп перед объединением
    const cleanedGroups = state.project.groups
      .map((g) => ({
        ...g,
        elementIds: g.elementIds.filter((id) => !selectedSet.has(id)),
      }))
      .filter((g) => g.elementIds.length >= 2);

    set({
      project: {
        ...state.project,
        elements: state.project.elements.map((el) =>
          selectedSet.has(el.id) ? { ...el, groupId } : el
        ),
        groups: [...cleanedGroups, newGroup],
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
      historyPast: [...state.historyPast.slice(-49), snapshot],
      historyFuture: [],
    });

    return groupId;
  },

  ungroupSelectedElements: () =>
    set((state) => {
      if (state.selectedElementIds.length === 0) return state;
      const selectedSet = new Set(state.selectedElementIds);
      const affectedGroupIds = new Set(
        state.project.elements
          .filter((el) => selectedSet.has(el.id) && el.groupId)
          .map((el) => el.groupId as string)
      );
      if (affectedGroupIds.size === 0) return state;

      const snapshot = cloneSnapshot(state.project);
      return {
        project: {
          ...state.project,
          elements: state.project.elements.map((el) =>
            el.groupId && affectedGroupIds.has(el.groupId)
              ? { ...el, groupId: undefined }
              : el
          ),
          groups: state.project.groups.filter((g) => !affectedGroupIds.has(g.id)),
          updatedAt: new Date().toISOString(),
        },
        saveStatus: "unsaved",
        historyPast: [...state.historyPast.slice(-49), snapshot],
        historyFuture: [],
      };
    }),

  addProfile: (profileInput) => {
    const id = `prof-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const newProfile: MaterialProfile = { ...profileInput, id, isExample: false };
    set((state) => {
      const nextProfiles = [...state.project.profiles, newProfile];
      saveProfileCatalog(nextProfiles);
      return {
        project: {
          ...state.project,
          profiles: nextProfiles,
          updatedAt: new Date().toISOString(),
        },
        activeProfileId: id,
        saveStatus: "unsaved",
      };
    });
    return id;
  },

  updateProfile: (id, patch) =>
    set((state) => {
      const nextProfiles = state.project.profiles.map((p) =>
        p.id === id ? { ...p, ...patch, isExample: false } : p
      );
      saveProfileCatalog(nextProfiles);
      return {
        project: {
          ...state.project,
          profiles: nextProfiles,
          updatedAt: new Date().toISOString(),
        },
        saveStatus: "unsaved",
      };
    }),

  deleteProfile: (id) => {
    const state = get();
    const isUsed = state.project.elements.some((el) => el.profileId === id);
    if (isUsed) {
      return {
        ok: false,
        reason: "Профиль используется в конструкции. Сначала замените профиль у элементов.",
      };
    }
    if (state.project.profiles.length <= 1) {
      return {
        ok: false,
        reason: "В каталоге должен оставаться хотя бы один профиль.",
      };
    }

    const nextProfiles = state.project.profiles.filter((p) => p.id !== id);
    saveProfileCatalog(nextProfiles);
    set({
      project: {
        ...state.project,
        profiles: nextProfiles,
        updatedAt: new Date().toISOString(),
      },
      activeProfileId:
        state.activeProfileId === id ? (nextProfiles[0]?.id ?? "") : state.activeProfileId,
      saveStatus: "unsaved",
    });
    return { ok: true };
  },

  assignProfileToElements: (elementIds, profileId) =>
    set((state) => {
      if (elementIds.length === 0) return state;
      const profileExists = state.project.profiles.some((p) => p.id === profileId);
      if (!profileExists) return state;

      const idSet = new Set(elementIds);
      const snapshot = cloneSnapshot(state.project);

      return {
        project: {
          ...state.project,
          elements: state.project.elements.map((el) =>
            idSet.has(el.id) ? { ...el, profileId } : el
          ),
          updatedAt: new Date().toISOString(),
        },
        saveStatus: "unsaved",
        historyPast: [...state.historyPast.slice(-49), snapshot],
        historyFuture: [],
      };
    }),

  replaceProfileInProject: (oldProfileId, newProfileId) =>
    set((state) => {
      if (oldProfileId === newProfileId) return state;
      const targetExists = state.project.profiles.some((p) => p.id === newProfileId);
      if (!targetExists) return state;

      const hasAffected = state.project.elements.some((el) => el.profileId === oldProfileId);
      if (!hasAffected) return state;

      const snapshot = cloneSnapshot(state.project);
      return {
        project: {
          ...state.project,
          elements: state.project.elements.map((el) =>
            el.profileId === oldProfileId ? { ...el, profileId: newProfileId } : el
          ),
          updatedAt: new Date().toISOString(),
        },
        saveStatus: "unsaved",
        historyPast: [...state.historyPast.slice(-49), snapshot],
        historyFuture: [],
      };
    }),

  saveCatalogAsDefault: () => {
    const profiles = get().project.profiles;
    const ok = saveProfileCatalog(profiles);
    if (typeof window !== "undefined") {
      void apiSaveProfileCatalog(profiles).catch(() => {});
    }
    return ok;
  },

  detectAndSyncJoints: () => {
    const state = get();
    const snapshot = cloneSnapshot(state.project);
    const nextJoints = detectProjectJoints(state.project.elements, state.project.joints);
    set({
      project: {
        ...state.project,
        joints: nextJoints,
        updatedAt: new Date().toISOString(),
      },
      selectedJointId: null,
      saveStatus: "unsaved",
      historyPast: [...state.historyPast.slice(-49), snapshot],
      historyFuture: [],
    });
    return nextJoints.length;
  },

  addManualJoint: (jointInput) => {
    const id = `j-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const state = get();
    const snapshot = cloneSnapshot(state.project);
    const newJoint: JointConnection = {
      ...jointInput,
      id,
      position: { ...jointInput.position },
      elementIds: [...jointInput.elementIds],
    };
    set({
      project: {
        ...state.project,
        joints: [...state.project.joints, newJoint],
        updatedAt: new Date().toISOString(),
      },
      selectedJointId: id,
      selectedElementIds: [],
      saveStatus: "unsaved",
      historyPast: [...state.historyPast.slice(-49), snapshot],
      historyFuture: [],
    });
    return id;
  },

  updateJoint: (id, patch) =>
    set((state) => {
      const target = state.project.joints.find((j) => j.id === id);
      if (!target) return state;
      const snapshot = cloneSnapshot(state.project);
      return {
        project: {
          ...state.project,
          joints: state.project.joints.map((j) =>
            j.id === id ? { ...j, ...patch } : j
          ),
          updatedAt: new Date().toISOString(),
        },
        saveStatus: "unsaved",
        historyPast: [...state.historyPast.slice(-49), snapshot],
        historyFuture: [],
      };
    }),

  deleteJoint: (id) =>
    set((state) => {
      const snapshot = cloneSnapshot(state.project);
      return {
        project: {
          ...state.project,
          joints: state.project.joints.filter((j) => j.id !== id),
          updatedAt: new Date().toISOString(),
        },
        selectedJointId: state.selectedJointId === id ? null : state.selectedJointId,
        saveStatus: "unsaved",
        historyPast: [...state.historyPast.slice(-49), snapshot],
        historyFuture: [],
      };
    }),

  estimateAllWeldLengthsByPerimeter: () =>
    set((state) => {
      const snapshot = cloneSnapshot(state.project);
      const updatedJoints = state.project.joints.map((joint) => {
        if (joint.weldLengthMm !== null && joint.weldLengthMm !== undefined) {
          return joint;
        }
        const estimated = estimateJointPerimeterWeldMm(
          joint,
          state.project.elements,
          state.project.profiles
        );
        return estimated !== null ? { ...joint, weldLengthMm: estimated } : joint;
      });

      return {
        project: {
          ...state.project,
          joints: updatedJoints,
          updatedAt: new Date().toISOString(),
        },
        saveStatus: "unsaved",
        historyPast: [...state.historyPast.slice(-49), snapshot],
        historyFuture: [],
      };
    }),

  updateCalculationSettings: (patch) =>
    set((state) => ({
      project: {
        ...state.project,
        calculationSettings: { ...state.project.calculationSettings, ...patch },
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    })),

  undo: () =>
    set((state) => {
      if (state.historyPast.length === 0) return state;
      const previous = state.historyPast[state.historyPast.length - 1];
      const currentSnapshot = cloneSnapshot(state.project);

      return {
        project: {
          ...state.project,
          elements: previous.elements,
          groups: previous.groups,
          joints: previous.joints,
          updatedAt: new Date().toISOString(),
        },
        selectedElementIds: [],
        saveStatus: "unsaved",
        historyPast: state.historyPast.slice(0, -1),
        historyFuture: [currentSnapshot, ...state.historyFuture.slice(0, 49)],
      };
    }),

  redo: () =>
    set((state) => {
      if (state.historyFuture.length === 0) return state;
      const next = state.historyFuture[0];
      const currentSnapshot = cloneSnapshot(state.project);

      return {
        project: {
          ...state.project,
          elements: next.elements,
          groups: next.groups,
          joints: next.joints,
          updatedAt: new Date().toISOString(),
        },
        selectedElementIds: [],
        saveStatus: "unsaved",
        historyPast: [...state.historyPast.slice(-49), currentSnapshot],
        historyFuture: state.historyFuture.slice(1),
      };
    }),

  renameProject: (name) =>
    set((state) => ({
      project: {
        ...state.project,
        name: name.trim() || "Без названия",
        isExample: false,
        updatedAt: new Date().toISOString(),
      },
      saveStatus: "unsaved",
    })),

  createNewProject: (name = "Новый проект") => {
    const nextProject = createEmptyProject(name);
    const savedCatalog = loadSavedProfileCatalog();
    nextProject.profiles = savedCatalog;
    set({
      project: nextProject,
      activeProfileId: nextProject.profiles[0]?.id ?? "",
      selectedElementIds: [],
      selectedJointId: null,
      historyPast: [],
      historyFuture: [],
      saveStatus: "unsaved",
      lastError: null,
    });
  },

  loadExampleProject: () => {
    const example = createExampleProject();
    example.id = `proj-example-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set({
      project: example,
      activeProfileId: example.profiles[2]?.id ?? example.profiles[0]?.id ?? "",
      selectedElementIds: [],
      selectedJointId: null,
      historyPast: [],
      historyFuture: [],
      saveStatus: "unsaved",
      lastError: null,
    });
  },

  fetchSavedProjects: async () => {
    set({ projectsLoading: true });
    try {
      const savedProjects = await apiListProjects();
      set({ savedProjects, projectsLoading: false, lastError: null });
      return savedProjects;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось загрузить проекты из SQLite.";
      set({ projectsLoading: false, lastError: message });
      return get().savedProjects;
    }
  },

  saveCurrentProject: async () => {
    const state = get();
    set({ saveStatus: "saving", lastError: null });
    try {
      const payload: MetalCalcProject = {
        ...state.project,
        updatedAt: new Date().toISOString(),
      };
      const saved = await apiSaveProject(payload);
      saveActiveProjectId(saved.id);
      const savedProjects = await apiListProjects().catch(() => state.savedProjects);
      set({
        project: saved,
        savedProjects,
        hasHydrated: true,
        saveStatus: "saved",
        lastError: null,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось сохранить проект в SQLite.";
      set({
        saveStatus: "error",
        lastError: message,
      });
      return false;
    }
  },

  openProjectById: async (id) => {
    set({ projectsLoading: true, lastError: null });
    try {
      const found = await apiGetProject(id);
      saveActiveProjectId(found.id);
      set({
        project: found,
        activeProfileId: found.profiles[0]?.id ?? "",
        selectedElementIds: [],
        selectedJointId: null,
        historyPast: [],
        historyFuture: [],
        hasHydrated: true,
        projectsLoading: false,
        saveStatus: "saved",
        lastError: null,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось открыть проект из SQLite.";
      set({ projectsLoading: false, lastError: message });
      return false;
    }
  },

  duplicateCurrentProject: async () => {
    const state = get();
    set({ saveStatus: "saving", lastError: null });
    try {
      const now = new Date().toISOString();
      const copy: MetalCalcProject = {
        ...state.project,
        id: `proj-${Date.now()}`,
        name: `${state.project.name} (копия)`,
        isExample: false,
        createdAt: now,
        updatedAt: now,
      };
      const savedCopy = await apiSaveProject(copy);
      saveActiveProjectId(savedCopy.id);
      const savedProjects = await apiListProjects().catch(() => state.savedProjects);
      set({
        project: savedCopy,
        savedProjects,
        selectedElementIds: [],
        selectedJointId: null,
        historyPast: [],
        historyFuture: [],
        hasHydrated: true,
        saveStatus: "saved",
        lastError: null,
      });
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось дублировать проект в SQLite.";
      set({ saveStatus: "error", lastError: message });
      return false;
    }
  },

  duplicateSavedProject: async (id) => {
    set({ projectsLoading: true, lastError: null });
    try {
      await apiDuplicateProject(id);
      const savedProjects = await apiListProjects();
      set({ savedProjects, projectsLoading: false, lastError: null });
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось создать копию проекта.";
      set({ projectsLoading: false, lastError: message });
      return false;
    }
  },

  renameSavedProject: async (id, name) => {
    const trimmed = name.trim();
    if (!trimmed) return false;
    set({ projectsLoading: true, lastError: null });
    try {
      const updated = await apiRenameProject(id, trimmed);
      const savedProjects = await apiListProjects();
      set((state) => ({
        savedProjects,
        projectsLoading: false,
        lastError: null,
        project: state.project.id === id ? updated : state.project,
      }));
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось переименовать проект.";
      set({ projectsLoading: false, lastError: message });
      return false;
    }
  },

  deleteSavedProject: async (id) => {
    set({ projectsLoading: true, lastError: null });
    try {
      await apiDeleteProject(id);
      const savedProjects = await apiListProjects();
      if (get().project.id === id) {
        if (savedProjects.length > 0) {
          const nextLoaded = await apiGetProject(savedProjects[0].id);
          saveActiveProjectId(nextLoaded.id);
          set({
            project: nextLoaded,
            activeProfileId: nextLoaded.profiles[0]?.id ?? "",
            savedProjects,
            selectedElementIds: [],
            selectedJointId: null,
            historyPast: [],
            historyFuture: [],
            projectsLoading: false,
            saveStatus: "saved",
            lastError: null,
          });
        } else {
          set({ savedProjects, projectsLoading: false });
          get().createNewProject("Новый проект");
        }
      } else {
        set({ savedProjects, projectsLoading: false, lastError: null });
      }
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось удалить проект.";
      set({ projectsLoading: false, lastError: message });
      return false;
    }
  },

  hydrateFromStorage: async () => {
    if (typeof window === "undefined") return;
    set({ projectsLoading: true });
    try {
      const [summaries, userCatalog] = await Promise.all([
        apiListProjects(),
        apiListProfileCatalog().catch(() => null),
      ]);
      if (userCatalog && userCatalog.length > 0) {
        saveProfileCatalog(userCatalog);
      }

      const currentState = get();

      if (currentState.hasHydrated || currentState.saveStatus === "unsaved") {
        set({ savedProjects: summaries, projectsLoading: false });
        return;
      }

      const activeId = readActiveProjectId();
      const targetId =
        (activeId && summaries.some((p) => p.id === activeId) ? activeId : summaries[0]?.id) ??
        null;

      if (targetId) {
        const loaded = await apiGetProject(targetId);
        saveActiveProjectId(loaded.id);
        set({
          project: loaded,
          activeProfileId: loaded.profiles[2]?.id ?? loaded.profiles[0]?.id ?? "",
          savedProjects: summaries,
          hasHydrated: true,
          projectsLoading: false,
          saveStatus: "saved",
          lastError: null,
        });
        return;
      }

      set({
        savedProjects: summaries,
        hasHydrated: true,
        projectsLoading: false,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Не удалось загрузить проекты из SQLite.";
      set({ projectsLoading: false, lastError: message });
    }
  },

  resetForUserSession: () => {
    clearActiveProjectId();
    clearSavedProfileCatalog();
    const fresh = createEmptyProject("Новый проект");
    set({
      project: fresh,
      savedProjects: [],
      projectsLoading: false,
      hasHydrated: false,
      activeTool: "select",
      activeProfileId: fresh.profiles[0]?.id ?? "",
      selectedElementIds: [],
      selectedJointId: null,
      saveStatus: "saved",
      lastError: null,
      historyPast: [],
      historyFuture: [],
    });
  },
}));
