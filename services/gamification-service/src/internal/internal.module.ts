import { Module } from "@nestjs/common";
import { InternalController } from "./internal.controller";
import { GamificationModule } from "../gamification/gamification.module";

@Module({
  imports: [GamificationModule],
  controllers: [InternalController],
})
export class InternalModule {}
