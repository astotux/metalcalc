import { ProjectsClient } from "@/components/projects/ProjectsClient";
import { requireAuthenticatedPageUser } from "@/lib/auth/requirePageUser";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await requireAuthenticatedPageUser("/projects");
  return <ProjectsClient />;
}
