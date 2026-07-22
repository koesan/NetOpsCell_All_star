import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditLog } from "../entities/audit-log.entity";
import { AuditService } from "./audit.service";
import { AuditConsumerService } from "./audit-consumer.service";

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  providers: [AuditService, AuditConsumerService],
  exports: [AuditService],
})
export class AuditModule {}
