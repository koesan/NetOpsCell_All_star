import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Incident } from "../entities/incident.entity";
import { IncidentResolution } from "../entities/incident-resolution.entity";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";

@Module({
  imports: [TypeOrmModule.forFeature([Incident, IncidentResolution])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
