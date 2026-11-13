import { EXAMPLE_PROFILES } from "@/features/profiles/defaults";
import { materialProfileSchema } from "@/lib/validation/schemas";
import type { MaterialProfile } from "@/types";

const STORAGE_KEY_PROFILE_CATALOG = "metalcalc_profile_catalog_v1";

/** Читает сохранённый пользователем каталог профилей из localStorage (или возвращает примеры). */
export function loadSavedProfileCatalog(): MaterialProfile[] {
  if (typeof window === "undefined") {
    return EXAMPLE_PROFILES.map((p) => ({ ...p }));
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PROFILE_CATALOG);
    if (!raw) {
      return EXAMPLE_PROFILES.map((p) => ({ ...p }));
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return EXAMPLE_PROFILES.map((p) => ({ ...p }));
    }
    const valid = parsed.filter((item) => materialProfileSchema.safeParse(item).success);
    return valid.length > 0 ? valid : EXAMPLE_PROFILES.map((p) => ({ ...p }));
  } catch {
    return EXAMPLE_PROFILES.map((p) => ({ ...p }));
  }
}

/** Сохраняет текущий каталог профилей как шаблон по умолчанию для новых проектов. */
export function saveProfileCatalog(profiles: MaterialProfile[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(STORAGE_KEY_PROFILE_CATALOG, JSON.stringify(profiles));
    return true;
  } catch {
    return false;
  }
}

/** Сбрасывает сохранённый каталог к стартовым примерам. */
export function clearSavedProfileCatalog(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY_PROFILE_CATALOG);
}
