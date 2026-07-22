import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "../rabbitmq/rabbitmq.service";
import { GamificationService } from "./gamification.service";

/**
 * Faz 2: Incident Service'ten gelen event'leri gercek RabbitMQ tuketimiyle isler
 * (Faz 1'de bu is /internal/simulate-event ile manuel tetikleniyordu - o endpoint
 * test/manuel mudahale icin hala mevcut, ama artik birincil yol bu consumer'dir).
 */
@Injectable()
export class GamificationConsumerService implements OnModuleInit {
  private readonly logger = new Logger(GamificationConsumerService.name);

  constructor(
    private readonly rabbitMQ: RabbitMQService,
    private readonly gamificationService: GamificationService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMQ.consume(
      "gamification.incident-events",
      ["incident.resolved", "incident.resolution.rated", "incident.sla.exceeded", "incident.repeated"],
      async (routingKey, payload) => {
        switch (routingKey) {
          case "incident.resolved":
            await this.gamificationService.handleIncidentResolved(payload as never);
            break;
          case "incident.resolution.rated":
            await this.gamificationService.handleResolutionRated(payload as never);
            break;
          case "incident.sla.exceeded":
            await this.gamificationService.handleSlaExceeded(payload as never);
            break;
          case "incident.repeated":
            await this.gamificationService.handleIncidentRepeated(payload as never);
            break;
          default:
            this.logger.warn(`Bilinmeyen routing key: ${routingKey}`);
        }
      }
    );
  }
}
