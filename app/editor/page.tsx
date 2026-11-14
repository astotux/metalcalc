import { MetalCalcEditor } from "@/components/editor/MetalCalcEditor";
import { requireAuthenticatedPageUser } from "@/lib/auth/requirePageUser";

export const dynamic = "force-dynamic";

export default async function EditorPage() {
  await requireAuthenticatedPageUser("/editor");
  return <MetalCalcEditor />;
}
