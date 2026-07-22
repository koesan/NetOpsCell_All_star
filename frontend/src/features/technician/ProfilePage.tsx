import { useState } from "react";
import { motion } from "framer-motion";
import { Award, CheckCircle2, Lock, Star, Target, TrendingUp, Trophy } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { PageHeader } from "../../components/ui/PageHeader";
import { Card, CardBody, CardHeader, CardTitle } from "../../components/ui/Card";
import { LoadingState } from "../../components/ui/States";
import { cn } from "../../lib/cn";
import { useBadgeCatalog, useLeaderboard, useMyProfile } from "../shared/gamificationHooks";
import { LEVEL_COLORS, LEVEL_LABELS, levelProgress } from "./levelUtils";

export function ProfilePage() {
  const { user } = useAuth();
  const { data: profile, isLoading } = useMyProfile(user?.id);
  const { data: badgeCatalog } = useBadgeCatalog();
  // Case 6.4: profil ekraninda hem gunluk hem haftalik siralama gosterilmelidir
  const { data: dailyLeaderboard } = useLeaderboard("daily");
  const { data: weeklyLeaderboard } = useLeaderboard("weekly");
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");

  if (isLoading || !profile) return <LoadingState label="Profil yükleniyor..." />;

  const progress = levelProgress(profile.totalPoints);
  const earnedSet = new Set(profile.badges);
  const myDailyRank = dailyLeaderboard?.find((l) => l.userId === user?.id)?.rank;
  const myWeeklyRank = weeklyLeaderboard?.find((l) => l.userId === user?.id)?.rank;
  const leaderboard = period === "daily" ? dailyLeaderboard : weeklyLeaderboard;

  return (
    <div>
      <PageHeader title="Profilim" description="Puanların, rozetlerin ve liderlik sıralaman." />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody className="pt-6">
            <div className="flex items-center gap-4">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold text-white shadow-soft"
                style={{ backgroundColor: LEVEL_COLORS[profile.level] }}
              >
                {LEVEL_LABELS[profile.level][0]}
              </div>
              <div className="flex-1">
                <p className="text-lg font-semibold text-navy-950">{LEVEL_LABELS[profile.level]} Seviye</p>
                <p className="text-sm text-navy-400">{profile.totalPoints} puan · {profile.resolvedCount} çözülen vaka</p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {myDailyRank && (
                  <div className="flex items-center gap-1.5 rounded-full bg-brand-yellow/20 px-3 py-1 text-xs font-semibold text-navy-900">
                    <Trophy className="h-3.5 w-3.5" /> #{myDailyRank} bugün
                  </div>
                )}
                {myWeeklyRank && (
                  <div className="flex items-center gap-1.5 rounded-full bg-navy-100 px-3 py-1 text-xs font-semibold text-navy-700">
                    <Trophy className="h-3.5 w-3.5" /> #{myWeeklyRank} bu hafta
                  </div>
                )}
              </div>
            </div>

            {progress.nextThreshold && (
              <div className="mt-5">
                <div className="flex justify-between text-xs text-navy-400">
                  <span>Sonraki seviyeye</span>
                  <span>{progress.nextThreshold - profile.totalPoints} puan kaldı</span>
                </div>
                <div className="mt-1.5 h-2.5 w-full overflow-hidden rounded-full bg-navy-50">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: LEVEL_COLORS[profile.level] }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress.percent}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            <div className="mt-6 grid grid-cols-3 gap-3">
              <MiniStat icon={Target} label="Çözülen" value={profile.resolvedCount} />
              <MiniStat icon={TrendingUp} label="Ortalama Puan" value={profile.averagePoints} />
              <MiniStat icon={Award} label="Rozet" value={profile.badges.length} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Liderlik</CardTitle>
            <div className="flex rounded-lg bg-navy-50 p-0.5">
              {(["daily", "weekly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-medium transition-all",
                    period === p ? "bg-white text-navy-900 shadow-soft" : "text-navy-400"
                  )}
                >
                  {p === "daily" ? "Günlük" : "Haftalık"}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-2">
            {leaderboard?.slice(0, 5).map((entry) => (
              <div
                key={entry.userId}
                className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm ${
                  entry.userId === user?.id ? "bg-brand-yellow/15 font-semibold" : "bg-navy-50/60"
                }`}
              >
                <span className="flex items-center gap-2 text-navy-700">
                  <span className="w-5 text-center text-xs text-navy-400">#{entry.rank}</span>
                  {entry.userId === user?.id ? "Sen" : entry.userId.slice(0, 8)}
                </span>
                <span className="text-navy-900">{entry.points} p</span>
              </div>
            ))}
            {(!leaderboard || leaderboard.length === 0) && <p className="text-xs text-navy-400">Henüz sıralama yok.</p>}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Rozetler</CardTitle>
        </CardHeader>
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {badgeCatalog?.map((badge) => {
            const earned = earnedSet.has(badge.code);
            return (
              <motion.div
                key={badge.code}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center ${
                  earned ? "border-brand-yellow/60 bg-brand-yellow/10" : "border-navy-100 bg-navy-50/40"
                }`}
              >
                {earned ? <CheckCircle2 className="h-6 w-6 text-brand-yellow-dark" /> : <Lock className="h-6 w-6 text-navy-300" />}
                <p className={`text-xs font-semibold ${earned ? "text-navy-900" : "text-navy-400"}`}>{badge.name}</p>
                <p className="text-[10px] text-navy-400">{badge.condition}</p>
              </motion.div>
            );
          })}
        </CardBody>
      </Card>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: typeof Star; label: string; value: number }) {
  return (
    <div className="rounded-xl bg-navy-50/60 p-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-navy-400" />
      <p className="mt-1 text-lg font-semibold text-navy-950">{value}</p>
      <p className="text-[11px] text-navy-400">{label}</p>
    </div>
  );
}
