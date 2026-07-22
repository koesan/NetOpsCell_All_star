import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";
import { AdminService } from "./admin.service";
import { AdminController } from "./admin.controller";
import { AuditModule } from "../audit/audit.module";
import { EventPublisherService } from "../common/events/event-publisher.service";

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuditModule],
  controllers: [AdminController],
  providers: [AdminService, EventPublisherService],
})
export class AdminModule {}
