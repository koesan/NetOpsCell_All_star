import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";
import type { Incident } from "../../types";

const CLOSED_STATUSES = ["COZULDU", "KAPANDI"];

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Aşıldı";
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}s ${minutes}dk`;
  return `${minutes}dk`;
}

export function SlaCountdown({ incident, compact }: { incident: Incident; compact?: boolean }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  if (!incident.slaDeadline || CLOSED_STATUSES.includes(incident.status)) {
    return <span className={cn("text-xs text-navy-300", compact && "block")}>—</span>;
  }

  const remainingMs = new Date(incident.slaDeadline).getTime() - Date.now();
  const exceeded = remainingMs <= 0;
  const urgent = !exceeded && remainingMs < 60 * 60 * 1000;

  return (
    <span
      className={cn(
        "text-xs font-semibold",
        exceeded ? "text-priority-kritik" : urgent ? "text-priority-yuksek" : "text-navy-500",
        compact && "block"
      )}
    >
      {formatRemaining(remainingMs)}
    </span>
  );
}
