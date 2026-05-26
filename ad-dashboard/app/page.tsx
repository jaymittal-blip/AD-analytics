import { fetchAllAds } from "@/lib/fetchAds";
import Dashboard from "@/components/Dashboard";

export const revalidate = 300;

export default async function HomePage() {
  const rawAds   = await fetchAllAds();
  const fetchedAt = new Date().toISOString();
  return <Dashboard rawAds={rawAds} fetchedAt={fetchedAt} />;
}
