import { AdClass } from "@/lib/types";

const CONFIG: Record<AdClass, { bg: string; text: string; dot: string; label: string }> = {
  KILL:       { bg: "bg-error-container",       text: "text-[#8C2A18]",  dot: "bg-error",       label: "Kill"       },
  SCALE:      { bg: "bg-secondary-container",   text: "text-[#1C4A32]",  dot: "bg-secondary",   label: "Scale"      },
  MONITOR:    { bg: "bg-tertiary-container",     text: "text-[#6A4010]",  dot: "bg-tertiary",    label: "Monitor"    },
  TESTING:    { bg: "bg-surface-container-high", text: "text-on-surface-variant", dot: "bg-outline", label: "Testing"    },
  ENDED_LOSS: { bg: "bg-error-container/60",     text: "text-[#8C2A18]",  dot: "bg-error/60",    label: "Ended Loss" },
  ENDED_WIN:  { bg: "bg-secondary-container/60", text: "text-[#1C4A32]",  dot: "bg-secondary/60", label: "Ended Win" },
  ENDED_OK:   { bg: "bg-surface-container",      text: "text-on-surface-variant", dot: "bg-outline/50", label: "Ended OK"  },
};

export default function Badge({ cls }: { cls: AdClass }) {
  const { bg, text, dot, label } = CONFIG[cls] ?? CONFIG.ENDED_OK;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap ${bg} ${text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  );
}
