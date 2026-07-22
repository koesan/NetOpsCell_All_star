import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function isoWeekKey(): string {
  const now = new Date();
  const target = new Date(now.valueOf());
  const dayNumber = (now.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNumber + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379", 10),
    });
  }

  onModuleDestroy() {
    this.client.disconnect();
  }

  private dailyKey(): string {
    return `leaderboard:daily:${todayKey()}`;
  }

  private weeklyKey(): string {
    return `leaderboard:weekly:${isoWeekKey()}`;
  }

  async addPoints(userId: string, points: number): Promise<void> {
    await Promise.all([this.client.zincrby(this.dailyKey(), points, userId), this.client.zincrby(this.weeklyKey(), points, userId)]);
  }

  async getLeaderboard(period: "daily" | "weekly", limit = 10): Promise<{ userId: string; score: number }[]> {
    const key = period === "daily" ? this.dailyKey() : this.weeklyKey();
    const raw = await this.client.zrevrange(key, 0, limit - 1, "WITHSCORES");
    const result: { userId: string; score: number }[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      result.push({ userId: raw[i], score: parseFloat(raw[i + 1]) });
    }
    return result;
  }
}
