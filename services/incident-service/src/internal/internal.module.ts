import { Module } from "@nestjs/common";
import { InternalController } from "./internal.controller";
import { IncidentsModule } from "../incidents/incidents.module";

@Module({
  imports: [IncidentsModule],
  controllers: [InternalController],
})
export class InternalModule {}
