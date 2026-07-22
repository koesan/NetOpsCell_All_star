import { Module } from "@nestjs/common";
import { MongoService } from "./mongo.service";
import { MessagingService } from "./messaging.service";

@Module({
  providers: [MongoService, MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
