import { LandingPageClient } from "@/components/landing/LandingPageClient";
import { getSessionUserFromCookies } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUserFromCookies();
  return <LandingPageClient initialUser={user} />;
}
