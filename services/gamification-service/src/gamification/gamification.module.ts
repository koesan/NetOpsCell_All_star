import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PointsLedger } from "../entities/points-ledger.entity";
import { BadgeEarned } from "../entities/badge-earned.entity";
import { UserStats } from "../entities/user-stats.entity";
import { GamificationController } from "./gamification.controller";
import { GamificationService } from "./gamification.service";
import { GamificationConsumerService } from "./gamification-consumer.service";
import { RedisService } from "../redis/redis.service";
import { EventPublisherService } from "../common/events/event-publisher.service";

@Module({
  imports: [TypeOrmModule.forFeature([PointsLedger, BadgeEarned, UserStats])],
  controllers: [GamificationController],
  providers: [GamificationService, GamificationConsumerService, RedisService, EventPublisherService],
  exports: [GamificationService],
})
export class GamificationModule {}
