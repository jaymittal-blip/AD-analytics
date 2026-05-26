import { fetchAllAds } from "@/lib/fetchAds";
import { analyzeAds, groupAds } from "@/lib/analyzer";
import Dashboard from "@/components/Dashboard";

export const revalidate = 300;

export default async function HomePage() {
  const raw      = await fetchAllAds();
  const ads      = analyzeAds(raw);
  const groups   = groupAds(ads);
  const fetchedAt = new Date().toISOString();

  return <Dashboard groups={groups} fetchedAt={fetchedAt} />;
}
