import { AdClass } from "@/lib/types";

const CONFIG: Record<AdClass, { bg: string; text: string; label: string }> = {
  KILL:       { bg: "bg-error-container",                             text: "text-on-error-container", label: "KILL"       },
  SCALE:      { bg: "bg-secondary/20 border border-secondary/30",     text: "text-secondary",          label: "SCALE"      },
  MONITOR:    { bg: "bg-tertiary/20 border border-tertiary/30",       text: "text-tertiary",           label: "MONITOR"    },
  TESTING:    { bg: "bg-surface-container-highest",                   text: "text-on-surface-variant", label: "TESTING"    },
  ENDED_LOSS: { bg: "bg-error-container/60",                          text: "text-on-error-container", label: "ENDED_LOSS" },
  ENDED_WIN:  { bg: "bg-secondary/10 border border-secondary/20",     text: "text-secondary",          label: "ENDED_WIN"  },
  ENDED_OK:   { bg: "bg-surface-container-high",                      text: "text-on-surface-variant", label: "ENDED_OK"   },
};

export default function Badge({ cls }: { cls: AdClass }) {
  const { bg, text, label } = CONFIG[cls] ?? CONFIG.ENDED_OK;
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-bold tracking-wide whitespace-nowrap ${bg} ${text}`}>
      {label}
    </span>
  );
}
