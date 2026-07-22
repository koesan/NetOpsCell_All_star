import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Incident } from "../entities/incident.entity";
import { IncidentStatusHistory } from "../entities/incident-status-history.entity";
import { IncidentResolution } from "../entities/incident-resolution.entity";
import { TelemetryReading } from "../entities/telemetry-reading.entity";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";
import { SlaScheduler } from "./sla.scheduler";
import { AiClientModule } from "../ai-client/ai-client.module";
import { EventPublisherService } from "../common/events/event-publisher.service";
import { MessagingModule } from "../messaging/messaging.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Incident, IncidentStatusHistory, IncidentResolution, TelemetryReading]),
    AiClientModule,
    MessagingModule,
  ],
  controllers: [IncidentsController],
  providers: [IncidentsService, SlaScheduler, EventPublisherService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
