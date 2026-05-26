export default function Loading() {
  return (
    <div className="flex items-center justify-center flex-1 min-h-screen bg-background">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-outline-variant border-t-primary-container rounded-full animate-spin mx-auto" />
        <p className="text-on-surface-variant text-sm">Fetching ad performance data…</p>
      </div>
    </div>
  );
}
