import { AdClass } from "@/lib/types";

const CONFIG: Record<AdClass, { bg: string; text: string; label: string }> = {
  KILL:       { bg: "bg-dash-kill/20 border border-dash-kill/40",  text: "text-dash-kill",  label: "KILL"       },
  SCALE:      { bg: "bg-dash-scale/20 border border-dash-scale/40", text: "text-dash-scale", label: "SCALE"      },
  MONITOR:    { bg: "bg-dash-watch/20 border border-dash-watch/40", text: "text-dash-watch", label: "MONITOR"    },
  TESTING:    { bg: "bg-dash-test/20 border border-dash-test/40",  text: "text-dash-test",  label: "TESTING"    },
  ENDED_LOSS: { bg: "bg-dash-ended/20 border border-dash-ended/40",text: "text-dash-muted", label: "ENDED_LOSS" },
  ENDED_WIN:  { bg: "bg-dash-scale/10 border border-dash-scale/30",text: "text-dash-scale", label: "ENDED_WIN"  },
  ENDED_OK:   { bg: "bg-dash-border/50",                           text: "text-dash-muted", label: "ENDED_OK"   },
};

export default function Badge({ cls }: { cls: AdClass }) {
  const { bg, text, label } = CONFIG[cls] ?? CONFIG.ENDED_OK;
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide whitespace-nowrap ${bg} ${text}`}
    >
      {label}
    </span>
  );
}
