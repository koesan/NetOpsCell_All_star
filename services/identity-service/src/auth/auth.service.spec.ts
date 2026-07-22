import { UnauthorizedException } from "@nestjs/common";
import { IsNull } from "typeorm";
import { AuthService } from "./auth.service";

/**
 * Regresyon testi — canli guvenlik testinde (case 10: "Gecersiz kilinmis refresh token'in
 * yeniden kullanimi") yakalanan gercek bir acigi kilitler: reuse-detection tetiklendiginde
 * ayni aileden (familyId) rotasyonla uretilmis KARDES token'in de iptal edilmesi gerekir.
 *
 * Kok neden: `refreshTokenRepo.update({ familyId, revokedAt: null }, ...)` — duz `null`
 * TypeORM'un update() kriterinde IS NULL'a guvenilir sekilde donusmuyordu; kardes token
 * revokedAt=null kaldigi icin calismaya devam ediyordu. Duzeltme: IsNull() operatoru.
 * Bu test, dogru operatorun kullanildigini mock uzerinden dogrular (SQL semantigini degil,
 * kodun niyetini kilitler — gercek TypeORM/Postgres davranisi ayrica canli dogrulanmistir).
 */
describe("AuthService.refresh — reuse detection", () => {
  function buildService(tokenRow: Record<string, unknown> | null) {
    const refreshTokenRepo = {
      findOne: jest.fn().mockResolvedValue(tokenRow),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      save: jest.fn(),
    };
    const userRepo = { findOne: jest.fn() };
    const otpRepo = {};
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const telegramService = { isConfigured: jest.fn().mockReturnValue(false) };

    const service = new AuthService(
      userRepo as never,
      refreshTokenRepo as never,
      otpRepo as never,
      auditService as never,
      telegramService as never
    );
    return { service, refreshTokenRepo, auditService };
  }

  it("kullanilmis bir refresh token tekrar geldiginde ailedeki TUM tokenlari (IsNull() ile) iptal eder", async () => {
    const familyId = "family-123";
    const { service, refreshTokenRepo, auditService } = buildService({
      id: "token-1",
      tokenHash: "irrelevant-because-we-bypass-hash-check-below",
      familyId,
      usedAt: new Date(), // <- daha once kullanilmis: reuse suphesi
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });

    // hashSecret private oldugu icin gercek secret'i hesaplayamayiz; findOne'i tokenHash
    // eslesecek sekilde stub'ladigimizdan (asagida) rawToken'in secret kismi onemsizdir.
    const hashSecretSpy = jest.spyOn(service as never, "hashSecret" as never).mockReturnValue("irrelevant-because-we-bypass-hash-check-below" as never);

    await expect(service.refresh("token-1.some-secret", null)).rejects.toThrow(UnauthorizedException);
    await expect(service.refresh("token-1.some-secret", null)).rejects.toThrow(/yeniden kullanim tespiti/);

    expect(refreshTokenRepo.update).toHaveBeenCalledWith(
      { familyId, revokedAt: IsNull() },
      { revokedAt: expect.any(Date) }
    );
    // KRITIK REGRESYON KONTROLU: criteria'da duz `null` kullanilmamali (bu, gercek DB'de
    // sessizce hicbir satiri etkilemeyen ve kardes token'in hayatta kalmasina yol acan
    // kok nedendi).
    const [criteria] = refreshTokenRepo.update.mock.calls[0];
    expect(criteria.revokedAt).not.toBeNull();
    expect(criteria.revokedAt).toEqual(IsNull());

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "REFRESH_TOKEN_TEKRAR_KULLANIM_SUPHESI", result: "FAILURE" })
    );

    hashSecretSpy.mockRestore();
  });

  it("iptal edilmis (revokedAt dolu) bir token da reuse olarak islenir", async () => {
    const familyId = "family-456";
    const { service, refreshTokenRepo } = buildService({
      id: "token-2",
      tokenHash: "x",
      familyId,
      usedAt: null,
      revokedAt: new Date(), // <- zaten iptal edilmis (onceki bir reuse-detection'dan)
      expiresAt: new Date(Date.now() + 60_000),
    });
    jest.spyOn(service as never, "hashSecret" as never).mockReturnValue("x" as never);

    await expect(service.refresh("token-2.secret", null)).rejects.toThrow(/yeniden kullanim tespiti/);
    expect(refreshTokenRepo.update).toHaveBeenCalledWith({ familyId, revokedAt: IsNull() }, expect.anything());
  });
});

/**
 * Regresyon testi — "doğrulanmadan girilmesin ve UI'da kod gözükmesin" gereksinimini kilitler.
 * Gerçek kanal Telegram Bot API'dir (telegram.service.ts); bot token tanımlı değilse (yerel
 * geliştirme) sabit kodlu bir simülasyon fallback'i devreye girer — ama bu modda dahi kod
 * HİÇBİR KOŞULDA register() yanıtında dönmemelidir (yalnızca sunucu logunda görünür).
 */
describe("AuthService.register — OTP kodu asla yanitta donmemeli", () => {
  it("Telegram yapilandirilmamisken (simulasyon) yanit sadece channel/linked icerir, kod yoktur", async () => {
    const userRepo = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((x) => x), save: jest.fn() };
    const refreshTokenRepo = {};
    const otpRepo = { insert: jest.fn().mockResolvedValue(undefined) };
    const auditService = { log: jest.fn() };
    const telegramService = { isConfigured: jest.fn().mockReturnValue(false) };

    const service = new AuthService(
      userRepo as never,
      refreshTokenRepo as never,
      otpRepo as never,
      auditService as never,
      telegramService as never
    );

    const result = await service.register({ gsm: "05551234567", name: "Test", surname: "User" } as never);

    expect(result).toEqual({ message: expect.any(String), channel: "SIMULATED", linked: true });
    expect(JSON.stringify(result)).not.toMatch(/\d{4}/); // yanitta 4 haneli bir kod gecmemeli
    expect(otpRepo.insert).toHaveBeenCalled(); // kod uretilip DB'ye yazildi (dogrulama icin), ama donmedi
  });

  it("Telegram baglanmamis kullanici icin OTP GONDERILMEZ, sadece baglanti linki doner", async () => {
    const userRepo = { findOne: jest.fn().mockResolvedValue({ id: "u1" }), create: jest.fn(), save: jest.fn() };
    const otpRepo = { insert: jest.fn() };
    const telegramService = {
      isConfigured: jest.fn().mockReturnValue(true),
      getOrCreateLink: jest.fn().mockResolvedValue({ chatId: null, linkToken: "abc123" }),
      buildDeepLink: jest.fn().mockReturnValue("https://t.me/NetOpsCellBot?start=abc123"),
    };

    const service = new AuthService(
      userRepo as never,
      {} as never,
      otpRepo as never,
      { log: jest.fn() } as never,
      telegramService as never
    );

    const result = await service.register({ gsm: "05551234567", name: "Test", surname: "User" } as never);

    expect(result.linked).toBe(false);
    expect(result.linkUrl).toBe("https://t.me/NetOpsCellBot?start=abc123");
    expect(otpRepo.insert).not.toHaveBeenCalled(); // baglanti tamamlanmadan kod uretilmemeli
  });
});
