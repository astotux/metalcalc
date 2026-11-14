import type { DbProjectSummary } from "@/lib/db/projectsRepository";
import type { MaterialProfile, MetalCalcProject } from "@/types";

function redirectOnUnauthorized(response: Response): void {
  if (response.status === 401 && typeof window !== "undefined") {
    const pathname = window.location.pathname;
    if (!pathname.startsWith("/login") && !pathname.startsWith("/register")) {
      const next = `${pathname}${window.location.search}`;
      window.location.replace(`/login?next=${encodeURIComponent(next || "/")}`);
    }
  }
}

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  redirectOnUnauthorized(response);
  try {
    const data = (await response.json()) as { error?: string; details?: string };
    if (data.details) return `${data.error ?? fallback}: ${data.details}`;
    return data.error ?? fallback;
  } catch {
    return fallback;
  }
}

export async function apiListProjects(): Promise<DbProjectSummary[]> {
  const res = await fetch("/api/projects", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Не удалось загрузить список проектов"));
  }
  const data = (await res.json()) as { projects: DbProjectSummary[] };
  return data.projects;
}

export async function apiGetProject(id: string): Promise<MetalCalcProject> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Не удалось открыть проект"));
  }
  const data = (await res.json()) as { project: MetalCalcProject };
  return data.project;
}

export async function apiSaveProject(project: MetalCalcProject): Promise<MetalCalcProject> {
  const res = await fetch(`/api/projects/${encodeURIComponent(project.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Не удалось сохранить проект в SQLite"));
  }
  const data = (await res.json()) as { project: MetalCalcProject };
  return data.project;
}

export async function apiRenameProject(id: string, name: string): Promise<MetalCalcProject> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "rename", name }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Не удалось переименовать проект"));
  }
  const data = (await res.json()) as { project: MetalCalcProject };
  return data.project;
}

export async function apiDuplicateProject(
  id: string,
  name?: string
): Promise<MetalCalcProject> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "duplicate", name }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Не удалось создать копию проекта"));
  }
  const data = (await res.json()) as { project: MetalCalcProject };
  return data.project;
}

export async function apiDeleteProject(id: string): Promise<void> {
  const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Не удалось удалить проект"));
  }
}

export async function apiListProfileCatalog(): Promise<MaterialProfile[]> {
  const res = await fetch("/api/profiles", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Не удалось загрузить каталог профилей"));
  }
  const data = (await res.json()) as { profiles: MaterialProfile[] };
  return data.profiles;
}

export async function apiSaveProfileCatalog(profiles: MaterialProfile[]): Promise<void> {
  const res = await fetch("/api/profiles", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ profiles }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, "Не удалось сохранить каталог профилей"));
  }
}
