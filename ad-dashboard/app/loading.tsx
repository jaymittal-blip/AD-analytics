export default function Loading() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-dash-bg">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-2 border-dash-border border-t-dash-watch rounded-full animate-spin mx-auto" />
        <p className="text-dash-muted text-sm">Fetching ad performance data…</p>
      </div>
    </div>
  );
}
