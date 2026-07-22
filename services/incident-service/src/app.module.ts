import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { TypeOrmModule } from "@nestjs/typeorm";

import { HealthController } from "./health/health.controller";
import { Incident } from "./entities/incident.entity";
import { IncidentStatusHistory } from "./entities/incident-status-history.entity";
import { IncidentResolution } from "./entities/incident-resolution.entity";
import { TelemetryReading } from "./entities/telemetry-reading.entity";

import { IncidentsModule } from "./incidents/incidents.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { InternalModule } from "./internal/internal.module";
import { RabbitMQModule } from "./rabbitmq/rabbitmq.module";

import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { EventPublisherService } from "./common/events/event-publisher.service";
import { readSecret } from "./common/secrets";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    RabbitMQModule,
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      username: process.env.DB_USER || "incident_user",
      password: readSecret("DB_PASSWORD", "changeme"),
      database: process.env.DB_NAME || "incident",
      entities: [Incident, IncidentStatusHistory, IncidentResolution, TelemetryReading],
      synchronize: true, // Faz 1: hackathon hizi icin. Uretimde migration'a gecilir.
    }),
    IncidentsModule,
    DashboardModule,
    InternalModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    EventPublisherService,
  ],
})
export class AppModule {}
