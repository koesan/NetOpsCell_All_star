import { Injectable, Logger } from "@nestjs/common";
import { RabbitMQService } from "../../rabbitmq/rabbitmq.service";

@Injectable()
export class EventPublisherService {
  private readonly logger = new Logger(EventPublisherService.name);

  constructor(private readonly rabbitMQ: RabbitMQService) {}

  async publish(eventType: string, payload: Record<string, unknown>): Promise<void> {
    this.logger.log(`event yayinlandi: ${eventType}`);
    await this.rabbitMQ.publish(eventType, payload);
  }
}
