import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "../entities/user.entity";
import { RefreshToken } from "../entities/refresh-token.entity";
import { OtpCode } from "../entities/otp-code.entity";
import { AuthService } from "./auth.service";
import { AuthController } from "./auth.controller";
import { EmailService } from "./email.service";
import { AuditModule } from "../audit/audit.module";

@Module({
  imports: [TypeOrmModule.forFeature([User, RefreshToken, OtpCode]), AuditModule],
  controllers: [AuthController],
  providers: [AuthService, EmailService],
  exports: [AuthService],
})
export class AuthModule {}
