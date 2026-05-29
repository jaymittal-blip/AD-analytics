import { unstable_noStore as noStore } from "next/cache";
import { getAllAds } from "@/lib/adsRepo";
import Dashboard from "@/components/Dashboard";

export default async function HomePage() {
  noStore(); // opts out of all CDN and Next.js caching — always renders fresh from DB
  const rawAds    = await getAllAds();
  const fetchedAt = new Date().toISOString();
  return <Dashboard rawAds={rawAds} fetchedAt={fetchedAt} />;
}
