import { useState } from "react";
import { motion } from "framer-motion";
import { Medal, Trophy } from "lucide-react";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card } from "../../components/ui/Card";
import { EmptyState, LoadingState } from "../../components/ui/States";
import { cn } from "../../lib/cn";
import { useLeaderboard } from "./gamificationHooks";

const MEDAL_COLORS = ["#F5A623", "#9CA3AF", "#B08D57"];

export function LeaderboardPage() {
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");
  const { data: leaderboard, isLoading } = useLeaderboard(period);

  return (
    <div>
      <PageHeader
        title="Liderlik Tablosu"
        description="Saha ekiplerinin puan sıralaması."
        action={
          <div className="flex rounded-xl bg-navy-50 p-1">
            {(["daily", "weekly"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all",
                  period === p ? "bg-white text-navy-900 shadow-soft" : "text-navy-400"
                )}
              >
                {p === "daily" ? "Günlük" : "Haftalık"}
              </button>
            ))}
          </div>
        }
      />

      <Card>
        {isLoading && <LoadingState />}
        {!isLoading && leaderboard?.length === 0 && (
          <EmptyState icon={<Trophy className="h-6 w-6 text-navy-300" />} title="Henüz sıralama verisi yok" />
        )}
        {!isLoading && leaderboard && leaderboard.length > 0 && (
          <div className="divide-y divide-navy-100/70">
            {leaderboard.map((entry, i) => (
              <motion.div
                key={entry.userId}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-4 px-5 py-3.5"
              >
                <div className="flex h-8 w-8 items-center justify-center">
                  {entry.rank <= 3 ? (
                    <Medal className="h-5 w-5" style={{ color: MEDAL_COLORS[entry.rank - 1] }} />
                  ) : (
                    <span className="text-sm font-semibold text-navy-300">#{entry.rank}</span>
                  )}
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-100 text-xs font-semibold text-navy-700">
                  {entry.userId.slice(0, 2).toUpperCase()}
                </div>
                <p className="flex-1 font-mono text-sm text-navy-700">{entry.userId}</p>
                <p className="text-sm font-semibold text-navy-950">{entry.points} puan</p>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
