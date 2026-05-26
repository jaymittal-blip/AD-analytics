import { getAllAds } from "@/lib/adsRepo";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic"; // always read fresh from Neon

export default async function HomePage() {
  const rawAds    = await getAllAds();
  const fetchedAt = new Date().toISOString();
  return <Dashboard rawAds={rawAds} fetchedAt={fetchedAt} />;
}
