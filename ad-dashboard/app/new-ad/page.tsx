export default function NewAdPage() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="flex items-center h-16 px-6 bg-surface border-b border-outline-variant/30 shrink-0">
        <h2 className="text-lg font-extrabold text-on-surface">New Analysis</h2>
      </header>
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center">
          <span className="material-symbols-outlined text-[64px] text-on-surface-variant block mb-4">add_circle</span>
          <p className="text-on-surface font-semibold mb-1">New Analysis</p>
          <p className="text-on-surface-variant text-sm">Manual ad entry and custom analysis coming soon.</p>
        </div>
      </div>
    </div>
  );
}
