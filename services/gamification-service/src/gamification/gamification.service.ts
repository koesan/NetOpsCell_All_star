import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { PointsLedger } from "../entities/points-ledger.entity";
import { BadgeEarned } from "../entities/badge-earned.entity";
import { UserStats } from "../entities/user-stats.entity";
import { BadgeCode, levelForPoints, POINTS } from "../common/enums/enums";
import { RedisService } from "../redis/redis.service";
import { EventPublisherService } from "../common/events/event-publisher.service";
import { BADGE_CATALOG } from "./badges.catalog";

export interface IncidentResolvedPayload {
  incident_id: string;
  team_id: string | null;
  fault_type: string;
  priority: string;
  created_at: string;
  resolved_at: string;
  within_half_sla: boolean;
  within_sla: boolean;
}

export interface ResolutionRatedPayload {
  incident_id: string;
  team_id: string | null;
  rating: number;
  is_permanent: boolean;
  rated_by: string;
  rated_at: string;
}

export interface SlaExceededPayload {
  incident_id: string;
  team_id: string | null;
  priority: string;
}

export interface IncidentRepeatedPayload {
  incident_id: string;
  prior_incident_id: string;
  team_id: string | null;
  station_code: string;
}

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    @InjectRepository(PointsLedger) private readonly ledgerRepo: Repository<PointsLedger>,
    @InjectRepository(BadgeEarned) private readonly badgeRepo: Repository<BadgeEarned>,
    @InjectRepository(UserStats) private readonly statsRepo: Repository<UserStats>,
    private readonly redisService: RedisService,
    private readonly eventPublisher: EventPublisherService
  ) {}

  private async getOrCreateStats(userId: string): Promise<UserStats> {
    let stats = await this.statsRepo.findOne({ where: { userId } });
    if (!stats) {
      stats = this.statsRepo.create({ userId, resolvedByType: {} });
      await this.statsRepo.save(stats);
    }
    return stats;
  }

  private async addPointsEntry(userId: string, points: number, reason: string, incidentId?: string): Promise<void> {
    await this.ledgerRepo.insert({ userId, points, reason, incidentId: incidentId ?? null });
    await this.statsRepo.increment({ userId }, "totalPoints", points);
    await this.redisService.addPoints(userId, points);
    await this.eventPublisher.publish("points.updated", { user_id: userId, points, reason, incident_id: incidentId ?? null });
  }

  async handleIncidentResolved(payload: IncidentResolvedPayload): Promise<{ newBadges: BadgeCode[] }> {
    if (!payload.team_id) return { newBadges: [] };
    const userId = payload.team_id;
    await this.getOrCreateStats(userId);

    await this.addPointsEntry(userId, POINTS.INCIDENT_RESOLVED, "ARIZA_COZULDU", payload.incident_id);
    if (payload.within_half_sla) {
      await this.addPointsEntry(userId, POINTS.FAST_RESPONSE_BONUS, "HIZLI_MUDAHALE_BONUSU", payload.incident_id);
    }
    if (payload.priority === "KRITIK" && payload.within_sla) {
      await this.addPointsEntry(userId, POINTS.CRITICAL_WITHIN_SLA_BONUS, "KRITIK_SLA_ICI_COZUM", payload.incident_id);
    }

    const today = new Date().toISOString().slice(0, 10);
    const stats = await this.getOrCreateStats(userId);
    const resolvedByType = { ...stats.resolvedByType };
    resolvedByType[payload.fault_type] = (resolvedByType[payload.fault_type] || 0) + 1;

    await this.statsRepo.update(
      { userId },
      {
        resolvedCount: stats.resolvedCount + 1,
        fastResponseCount: stats.fastResponseCount + (payload.within_half_sla ? 1 : 0),
        criticalWithinSlaCount: stats.criticalWithinSlaCount + (payload.priority === "KRITIK" && payload.within_sla ? 1 : 0),
        noRepeatStreak: stats.noRepeatStreak + 1,
        dailyResolvedDate: today,
        dailyResolvedCount: stats.dailyResolvedDate === today ? stats.dailyResolvedCount + 1 : 1,
        resolvedByType,
      }
    );

    return this.checkBadges(userId);
  }

  async handleResolutionRated(payload: ResolutionRatedPayload): Promise<{ newBadges: BadgeCode[] }> {
    if (!payload.team_id) return { newBadges: [] };
    await this.getOrCreateStats(payload.team_id);
    if (payload.is_permanent) {
      await this.addPointsEntry(payload.team_id, POINTS.PERMANENT_FIX_BONUS, "KALICI_COZUM_BONUSU", payload.incident_id);
    }
    return this.checkBadges(payload.team_id);
  }

  async handleSlaExceeded(payload: SlaExceededPayload): Promise<void> {
    if (!payload.team_id) return;
    await this.getOrCreateStats(payload.team_id);
    await this.addPointsEntry(payload.team_id, POINTS.SLA_EXCEEDED_PENALTY, "SLA_ASIMI", payload.incident_id);
  }

  async handleIncidentRepeated(payload: IncidentRepeatedPayload): Promise<void> {
    if (!payload.team_id) return;
    await this.getOrCreateStats(payload.team_id);
    await this.addPointsEntry(payload.team_id, POINTS.REPEATED_INCIDENT_PENALTY, "TEKRAR_EDEN_ARIZA", payload.prior_incident_id);
    await this.statsRepo.update({ userId: payload.team_id }, { noRepeatStreak: 0 });
  }

  private async checkBadges(userId: string): Promise<{ newBadges: BadgeCode[] }> {
    const stats = await this.getOrCreateStats(userId);
    const alreadyEarned = new Set((await this.badgeRepo.find({ where: { userId } })).map((b) => b.badgeCode));
    const newBadges: BadgeCode[] = [];

    const maxResolvedByType = Math.max(0, ...Object.values(stats.resolvedByType || {}));

    const conditions: Record<BadgeCode, boolean> = {
      [BadgeCode.ILK_MUDAHALE]: stats.resolvedCount >= 1,
      [BadgeCode.HIZ_USTASI]: stats.fastResponseCount >= 10,
      [BadgeCode.KALICI_COZUM]: stats.noRepeatStreak >= 20,
      [BadgeCode.MARATONCU]: stats.dailyResolvedCount >= 15,
      [BadgeCode.KRIZ_YONETICISI]: stats.criticalWithinSlaCount >= 10,
      [BadgeCode.UZMAN]: maxResolvedByType >= 50,
    };

    for (const [code, met] of Object.entries(conditions) as [BadgeCode, boolean][]) {
      if (met && !alreadyEarned.has(code)) {
        await this.badgeRepo.insert({ userId, badgeCode: code });
        newBadges.push(code);
        this.logger.log(`Rozet kazanildi: ${userId} -> ${code}`);
        await this.eventPublisher.publish("badge.earned", {
          user_id: userId,
          badge_code: code,
          earned_at: new Date().toISOString(),
        });
      }
    }

    return { newBadges };
  }

  async getLeaderboard(period: "daily" | "weekly") {
    const rows = await this.redisService.getLeaderboard(period, 10);
    return rows.map((r, index) => ({ rank: index + 1, userId: r.userId, points: r.score }));
  }

  async getProfile(userId: string) {
    const stats = await this.getOrCreateStats(userId);
    const badges = await this.badgeRepo.find({ where: { userId } });
    const averagePoints = stats.resolvedCount > 0 ? Math.round((stats.totalPoints / stats.resolvedCount) * 100) / 100 : 0;

    return {
      userId,
      totalPoints: stats.totalPoints,
      level: levelForPoints(stats.totalPoints),
      resolvedCount: stats.resolvedCount,
      averagePoints,
      badges: badges.map((b) => b.badgeCode),
    };
  }

  getBadgeCatalog() {
    return BADGE_CATALOG;
  }
}
