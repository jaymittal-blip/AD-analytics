import { fmtINR } from "@/lib/format";

interface BreakdownGridProps {
  byPlatform: [string, number][];
  byBrand: [string, number][];
  valueColor?: string;
}

function BreakdownCard({
  title,
  rows,
  valueColor,
}: {
  title: string;
  rows: [string, number][];
  valueColor: string;
}) {
  return (
    <div className="bg-dash-surface border border-dash-border rounded-xl p-4">
      <h4 className="text-[10px] uppercase tracking-widest text-dash-muted mb-3">{title}</h4>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([key, val]) => (
            <tr key={key} className="border-b border-dash-border last:border-0">
              <td className="py-1.5 text-dash-text">{key}</td>
              <td className={`py-1.5 text-right font-semibold ${valueColor}`}>
                {fmtINR(val)}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td className="py-3 text-dash-muted text-xs" colSpan={2}>
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function BreakdownGrid({
  byPlatform,
  byBrand,
  valueColor = "text-dash-kill",
}: BreakdownGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
      <BreakdownCard title="Spend by Platform" rows={byPlatform} valueColor={valueColor} />
      <BreakdownCard title="Spend by Brand"    rows={byBrand}    valueColor={valueColor} />
    </div>
  );
}
