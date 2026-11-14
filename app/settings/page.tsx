import { SettingsClient } from "@/components/settings/SettingsClient";
import { requireAuthenticatedPageUser } from "@/lib/auth/requirePageUser";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAuthenticatedPageUser("/settings");
  return <SettingsClient />;
}
