import Dashboard from "@/components/Dashboard";

// All data is fetched client-side so the CDN never serves stale ad data
export default function HomePage() {
  return <Dashboard rawAds={[]} fetchedAt="" />;
}
