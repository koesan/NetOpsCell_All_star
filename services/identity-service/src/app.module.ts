import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { TypeOrmModule } from "@nestjs/typeorm";

import { HealthController } from "./health/health.controller";
import { User } from "./entities/user.entity";
import { RefreshToken } from "./entities/refresh-token.entity";
import { AuditLog } from "./entities/audit-log.entity";
import { OtpCode } from "./entities/otp-code.entity";
import { TelegramLink } from "./entities/telegram-link.entity";

import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./admin/admin.module";
import { AuditModule } from "./audit/audit.module";
import { InternalModule } from "./internal/internal.module";
import { RabbitMQModule } from "./rabbitmq/rabbitmq.module";

import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { readSecret } from "./common/secrets";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      username: process.env.DB_USER || "identity_user",
      password: readSecret("DB_PASSWORD", "changeme"),
      database: process.env.DB_NAME || "identity",
      entities: [User, RefreshToken, AuditLog, OtpCode, TelegramLink],
      synchronize: true, // Faz 1: hackathon hizi icin. Uretimde migration'a gecilir.
    }),
    RabbitMQModule,
    AuthModule,
    AdminModule,
    AuditModule,
    InternalModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
