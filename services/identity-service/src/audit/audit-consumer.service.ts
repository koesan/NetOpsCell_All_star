import { Injectable, OnModuleInit } from "@nestjs/common";
import { RabbitMQService } from "../rabbitmq/rabbitmq.service";
import { AuditService } from "./audit.service";

/**
 * Diger servislerden (Incident, Gamification) gelen audit.log event'lerini dinleyip
 * merkezi audit_logs tablosuna yazar (bkz. ARCHITECTURE.md Bolum 4.2, case 3.4).
 */
@Injectable()
export class AuditConsumerService implements OnModuleInit {
  constructor(
    private readonly rabbitMQ: RabbitMQService,
    private readonly auditService: AuditService
  ) {}

  async onModuleInit(): Promise<void> {
    await this.rabbitMQ.consume("identity.audit-log", ["audit.log"], async (_routingKey, payload) => {
      await this.auditService.log({
        userId: (payload.user_id as string) ?? null,
        actionType: payload.action_type as string,
        ip: (payload.ip as string) ?? null,
        result: payload.result as "SUCCESS" | "FAILURE",
        detail: (payload.detail as Record<string, unknown>) ?? null,
      });
    });
  }
}
