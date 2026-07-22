import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, LessThan, Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

import { User } from "../entities/user.entity";
import { RefreshToken } from "../entities/refresh-token.entity";
import { OtpCode } from "../entities/otp-code.entity";
import { Role } from "../common/enums/role.enum";
import { UserStatus } from "../common/enums/user-status.enum";
import { RegisterDto } from "./dto/register.dto";
import { VerifyOtpDto } from "./dto/verify-otp.dto";
import { LoginDto } from "./dto/login.dto";
import { AuditService } from "../audit/audit.service";
import { signAccessToken } from "./jwt.util";

const OTP_TTL_MINUTES = 5;
const ACCOUNT_LOCK_MAX_ATTEMPTS = parseInt(process.env.ACCOUNT_LOCK_MAX_ATTEMPTS || "5", 10);
const ACCOUNT_LOCK_DURATION_MINUTES = parseInt(process.env.ACCOUNT_LOCK_DURATION_MINUTES || "15", 10);
const REFRESH_TTL_DAYS = 7;

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(RefreshToken) private readonly refreshTokenRepo: Repository<RefreshToken>,
    @InjectRepository(OtpCode) private readonly otpRepo: Repository<OtpCode>,
    private readonly auditService: AuditService
  ) {}

  private normalizeGsm(gsm: string): string {
    return gsm.startsWith("0") ? gsm : `0${gsm}`;
  }

  async register(dto: RegisterDto): Promise<{ message: string; otpHint?: string }> {
    const gsm = this.normalizeGsm(dto.gsm);

    // Bu uc nokta hem ilk kayit hem de mevcut (ACTIVE) musterinin OTP ile giris yapmak
    // icin yeni bir kod istemesi amaciyla kullanilir - GSM zaten kimlik dogrulama
    // faktoru oldugu icin ACTIVE kullanicilar icin CONFLICT firlatmak, donen musterilerin
    // bir daha asla giris yapamamasina yol acardi.
    let user = await this.userRepo.findOne({ where: { gsm } });
    if (!user) {
      user = this.userRepo.create({
        role: Role.MUSTERI,
        gsm,
        email: dto.email ?? null,
        name: dto.name,
        surname: dto.surname,
        status: UserStatus.PENDING_VERIFICATION,
      });
      await this.userRepo.save(user);
    }

    const isSimulated = (process.env.OTP_MODE || "SIMULATED") === "SIMULATED";
    const code = isSimulated ? process.env.OTP_FIXED_CODE || "1234" : String(Math.floor(1000 + Math.random() * 9000));

    await this.otpRepo.insert({
      gsm,
      code,
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000),
    });

    return {
      message: "OTP kodu gonderildi.",
      ...(isSimulated ? { otpHint: `Simulasyon modu: sabit kod ${code}` } : {}),
    };
  }

  async verifyOtp(dto: VerifyOtpDto, ip: string | null): Promise<TokenPair> {
    const gsm = this.normalizeGsm(dto.gsm);

    const otp = await this.otpRepo.findOne({
      where: { gsm, code: dto.code, verifiedAt: null as unknown as Date },
      order: { createdAt: "DESC" },
    });

    if (!otp || otp.expiresAt.getTime() < Date.now()) {
      await this.auditService.log({
        userId: null,
        actionType: "OTP_DOGRULAMA",
        ip,
        result: "FAILURE",
        detail: { gsm },
      });
      throw new BadRequestException("OTP kodu gecersiz veya suresi dolmus.");
    }

    otp.verifiedAt = new Date();
    await this.otpRepo.save(otp);

    const user = await this.userRepo.findOne({ where: { gsm } });
    if (!user) {
      throw new BadRequestException("Kullanici bulunamadi, once kayit olunuz.");
    }
    user.status = UserStatus.ACTIVE;
    await this.userRepo.save(user);

    await this.auditService.log({
      userId: user.id,
      actionType: "OTP_DOGRULAMA",
      ip,
      result: "SUCCESS",
      detail: { gsm },
    });

    return this.issueTokenPair(user);
  }

  async login(dto: LoginDto, ip: string | null): Promise<TokenPair> {
    const user = await this.userRepo.findOne({ where: { email: dto.email } });

    if (!user || user.role === Role.MUSTERI) {
      await this.auditService.log({
        userId: null,
        actionType: "GIRIS_DENEMESI",
        ip,
        result: "FAILURE",
        detail: { email: dto.email, reason: "kullanici_bulunamadi" },
      });
      throw new UnauthorizedException("E-posta veya sifre hatali.");
    }

    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const remainingMinutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new UnauthorizedException(`Hesap kilitli. Kalan sure: ${remainingMinutes} dakika.`);
    }

    const passwordOk = user.passwordHash ? await bcrypt.compare(dto.password, user.passwordHash) : false;

    if (!passwordOk) {
      user.failedLoginCount += 1;
      if (user.failedLoginCount >= ACCOUNT_LOCK_MAX_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + ACCOUNT_LOCK_DURATION_MINUTES * 60 * 1000);
        await this.auditService.log({
          userId: user.id,
          actionType: "HESAP_KILITLENDI",
          ip,
          result: "FAILURE",
          detail: { failedLoginCount: user.failedLoginCount },
        });
      }
      await this.userRepo.save(user);

      await this.auditService.log({
        userId: user.id,
        actionType: "GIRIS_DENEMESI",
        ip,
        result: "FAILURE",
        detail: { reason: "hatali_sifre", failedLoginCount: user.failedLoginCount },
      });
      throw new UnauthorizedException("E-posta veya sifre hatali.");
    }

    user.failedLoginCount = 0;
    user.lockedUntil = null;
    await this.userRepo.save(user);

    await this.auditService.log({
      userId: user.id,
      actionType: "GIRIS_DENEMESI",
      ip,
      result: "SUCCESS",
      detail: null,
    });

    return this.issueTokenPair(user);
  }

  async refresh(rawToken: string, ip: string | null): Promise<TokenPair> {
    const [tokenId, secret] = rawToken.split(".");
    if (!tokenId || !secret) {
      throw new UnauthorizedException("Refresh token formati gecersiz.");
    }

    const tokenRow = await this.refreshTokenRepo.findOne({ where: { id: tokenId } });
    const secretHash = this.hashSecret(secret);

    if (!tokenRow || tokenRow.tokenHash !== secretHash || tokenRow.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException("Refresh token gecersiz veya suresi dolmus.");
    }

    if (tokenRow.usedAt || tokenRow.revokedAt) {
      // Reuse detection: daha once kullanilmis/iptal edilmis bir refresh token tekrar geldi -> calinma supheli.
      // KRITIK: criteria objesinde duz `revokedAt: null` TypeORM'un update() metodunda IS NULL'a
      // guvenilir sekilde donusmuyor (canli guvenlik testinde yakalandi: rotasyondaki kardes token
      // iptal edilmeden calismaya devam ediyordu). IsNull() operatoru dogru SQL'i garanti eder.
      await this.refreshTokenRepo.update(
        { familyId: tokenRow.familyId, revokedAt: IsNull() },
        { revokedAt: new Date() }
      );
      await this.auditService.log({
        userId: tokenRow.userId,
        actionType: "REFRESH_TOKEN_TEKRAR_KULLANIM_SUPHESI",
        ip,
        result: "FAILURE",
        detail: { familyId: tokenRow.familyId },
      });
      throw new UnauthorizedException("Token yeniden kullanim tespiti - tum oturumlar sonlandirildi.");
    }

    tokenRow.usedAt = new Date();
    await this.refreshTokenRepo.save(tokenRow);

    const user = await this.userRepo.findOne({ where: { id: tokenRow.userId } });
    if (!user) {
      throw new UnauthorizedException("Kullanici bulunamadi.");
    }

    return this.issueTokenPair(user, tokenRow.familyId);
  }

  async logout(rawToken: string): Promise<void> {
    const [tokenId] = rawToken.split(".");
    if (!tokenId) return;
    await this.refreshTokenRepo.update({ id: tokenId }, { revokedAt: new Date() });
  }

  async me(userId: string): Promise<Partial<User>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("Kullanici bulunamadi.");
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  private hashSecret(secret: string): string {
    return crypto.createHash("sha256").update(secret).digest("hex");
  }

  private async issueTokenPair(user: User, familyId: string = uuidv4()): Promise<TokenPair> {
    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      name: [user.name, user.surname].filter(Boolean).join(" ") || undefined,
      expertise: user.expertise ?? undefined,
      region: user.region ?? undefined,
    });

    const tokenId = uuidv4();
    const secret = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.refreshTokenRepo.insert({
      id: tokenId,
      userId: user.id,
      familyId,
      tokenHash: this.hashSecret(secret),
      usedAt: null,
      revokedAt: null,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: `${tokenId}.${secret}`,
      expiresIn: process.env.JWT_ACCESS_TTL || "15m",
    };
  }

  // Faz bakimi: suresi gecmis OTP kayitlarinin temizlenmesi (basit hijyen, cron degil - Faz 2'de scheduler'a tasinabilir)
  async purgeExpiredOtps(): Promise<void> {
    await this.otpRepo.delete({ expiresAt: LessThan(new Date()) });
  }
}
