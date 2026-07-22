import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { AiClientService } from "./ai-client.service";

@Module({
  imports: [HttpModule],
  providers: [AiClientService],
  exports: [AiClientService],
})
export class AiClientModule {}
