import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";
import { InternalController } from "./internal.controller";

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [InternalController],
})
export class InternalModule {}
