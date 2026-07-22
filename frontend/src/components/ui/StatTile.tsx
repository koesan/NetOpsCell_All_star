import type { LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";

interface StatTileProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: "navy" | "yellow" | "kritik" | "emerald" | "amber";
  hint?: string;
}

const ACCENT_STYLES: Record<NonNullable<StatTileProps["accent"]>, string> = {
  navy: "bg-navy-50 text-navy-900",
  yellow: "bg-yellow-50 text-yellow-700",
  kritik: "bg-red-50 text-priority-kritik",
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
};

export function StatTile({ label, value, icon: Icon, accent = "navy", hint }: StatTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-navy-100/70 bg-white p-5 shadow-soft"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-navy-400">{label}</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-tight text-navy-950">{value}</p>
          {hint && <p className="mt-1 text-xs text-navy-400">{hint}</p>}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", ACCENT_STYLES[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
