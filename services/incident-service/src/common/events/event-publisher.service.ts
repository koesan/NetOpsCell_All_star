import { Injectable, Logger } from "@nestjs/common";
import { RabbitMQService } from "../../rabbitmq/rabbitmq.service";

/**
 * Faz 2: RabbitMQ'ya gercek publish yapar. Cagiran kod (IncidentsService, RolesGuard)
 * Faz 1'den beri degismedi. Bkz. docs/ARCHITECTURE.md Bolum 7, EVENTS.md
 */
@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(private readonly rabbitMQ: RabbitMQService) {}

  async publish(eventType: string, payload: Record<string, unknown>): Promise<void> {
    this.logger.log(`event yayinlandi: ${eventType}`);
    await this.rabbitMQ.publish(eventType, payload);
  }
}
