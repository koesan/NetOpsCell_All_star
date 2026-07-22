import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";

import { HealthController } from "./health/health.controller";
import { PointsLedger } from "./entities/points-ledger.entity";
import { BadgeEarned } from "./entities/badge-earned.entity";
import { UserStats } from "./entities/user-stats.entity";

import { GamificationModule } from "./gamification/gamification.module";
import { InternalModule } from "./internal/internal.module";
import { RabbitMQModule } from "./rabbitmq/rabbitmq.module";

import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { readSecret } from "./common/secrets";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    RabbitMQModule,
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      username: process.env.DB_USER || "gamification_user",
      password: readSecret("DB_PASSWORD", "changeme"),
      database: process.env.DB_NAME || "gamification",
      entities: [PointsLedger, BadgeEarned, UserStats],
      synchronize: true, // Faz 1: hackathon hizi icin. Uretimde migration'a gecilir.
    }),
    GamificationModule,
    InternalModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
