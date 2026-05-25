import { fetchAllAds } from "@/lib/fetchAds";
import { analyzeAds, groupAds, computeMetrics } from "@/lib/analyzer";
import Dashboard from "@/components/Dashboard";

export const revalidate = 300; // ISR: re-fetch every 5 minutes in production

export default async function HomePage() {
  const raw      = await fetchAllAds();
  const ads      = analyzeAds(raw);
  const groups   = groupAds(ads);
  const metrics  = computeMetrics(ads);
  const fetchedAt = new Date().toISOString();

  return (
    <Dashboard
      groups={groups}
      metrics={metrics}
      fetchedAt={fetchedAt}
    />
  );
}
