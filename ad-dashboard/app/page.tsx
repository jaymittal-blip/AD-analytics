import { unstable_noStore as noStore } from "next/cache";
import { getAllAds, fetchFromExternalApi } from "@/lib/adsRepo";
import Dashboard from "@/components/Dashboard";

export default async function HomePage() {
  noStore();

  // Respect the user's data source preference on SSR too
  let dataSource = "api";
  try {
    const { getAppSetting } = await import("@/lib/usersRepo");
    dataSource = await getAppSetting<string>("data_source") ?? "api";
  } catch {}

  // Sheets: fast DB fetch | API: parallel external fetch (all pages at once)
  const rawAds    = dataSource === "sheets" ? await getAllAds() : await fetchFromExternalApi();
  const fetchedAt = new Date().toISOString();

  return <Dashboard rawAds={rawAds} fetchedAt={fetchedAt} />;
}
