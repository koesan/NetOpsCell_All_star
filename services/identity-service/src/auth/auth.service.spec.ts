import { UnauthorizedException } from "@nestjs/common";
import { IsNull } from "typeorm";
import { AuthService } from "./auth.service";

/**
 * Regresyon testi — canli guvenlik testinde (case 10: "Gecersiz kilinmis refresh token'in
 * yeniden kullanimi") yakalanan gercek bir acigi kilitler: reuse-detection tetiklendiginde
 * kullanicinin TUM oturumlarinin (case metni: "o kullanicinin tum oturumlari sonlandirilir")
 * iptal edilmesi gerekir — yalnizca ayni cihazin/oturumun token ailesi (familyId) degil.
 *
 * Kok neden 1 (duzeltildi): `refreshTokenRepo.update({ familyId, revokedAt: null }, ...)` — duz
 * `null` TypeORM'un update() kriterinde IS NULL'a guvenilir sekilde donusmuyordu; kardes token
 * revokedAt=null kaldigi icin calismaya devam ediyordu. Duzeltme: IsNull() operatoru.
 *
 * Kok neden 2 (bu turda duzeltildi): iptal kriteri `familyId` bazliydi. `issueTokenPair()` her
 * login/OTP dogrulamasinda YENI bir familyId uretir (parametre verilmezse) — yani kullanicinin
 * farkli cihazlardaki oturumlari ayri ailelerdedir. Bir cihazdaki token calinip reuse tespit
 * edildiginde sadece o cihazin ailesi iptal ediliyordu, diger cihazlardaki aktif oturumlar
 * etkilenmeden calismaya devam ediyordu. Duzeltme: kriter `familyId` yerine `userId` bazli.
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

    const emailService = { isConfigured: jest.fn().mockReturnValue(false) };
    const service = new AuthService(
      userRepo as never,
      refreshTokenRepo as never,
      otpRepo as never,
      auditService as never,
      emailService as never
    );
    return { service, refreshTokenRepo, auditService };
  }

  it("kullanilmis bir refresh token tekrar geldiginde kullanicinin TUM tokenlarini (IsNull() ile) iptal eder", async () => {
    const userId = "user-abc";
    const familyId = "family-123"; // <- calinan cihazin ailesi (artik iptal kriterinde kullanilmiyor)
    const { service, refreshTokenRepo, auditService } = buildService({
      id: "token-1",
      tokenHash: "irrelevant-because-we-bypass-hash-check-below",
      userId,
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
      { userId, revokedAt: IsNull() },
      { revokedAt: expect.any(Date) }
    );
    // KRITIK REGRESYON KONTROLU: criteria'da duz `null` kullanilmamali (bu, gercek DB'de
    // sessizce hicbir satiri etkilemeyen ve kardes token'in hayatta kalmasina yol acan
    // kok nedendi).
    const [criteria] = refreshTokenRepo.update.mock.calls[0];
    expect(criteria.revokedAt).not.toBeNull();
    expect(criteria.revokedAt).toEqual(IsNull());
    // KRITIK REGRESYON KONTROLU (bu tur): kriter familyId DEGIL, userId bazli olmali — aksi
    // halde kullanicinin diger cihazlardaki (farkli familyId) oturumlari hayatta kalir.
    expect(criteria).not.toHaveProperty("familyId");
    expect(criteria.userId).toEqual(userId);

    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "REFRESH_TOKEN_TEKRAR_KULLANIM_SUPHESI", result: "FAILURE" })
    );

    hashSecretSpy.mockRestore();
  });

  it("iptal edilmis (revokedAt dolu) bir token da reuse olarak islenir", async () => {
    const userId = "user-def";
    const familyId = "family-456";
    const { service, refreshTokenRepo } = buildService({
      id: "token-2",
      tokenHash: "x",
      userId,
      familyId,
      usedAt: null,
      revokedAt: new Date(), // <- zaten iptal edilmis (onceki bir reuse-detection'dan)
      expiresAt: new Date(Date.now() + 60_000),
    });
    jest.spyOn(service as never, "hashSecret" as never).mockReturnValue("x" as never);

    await expect(service.refresh("token-2.secret", null)).rejects.toThrow(/yeniden kullanim tespiti/);
    expect(refreshTokenRepo.update).toHaveBeenCalledWith({ userId, revokedAt: IsNull() }, expect.anything());
  });

  it("iki farkli cihazdaki (farkli familyId) oturumlar, birinde reuse tespit edilirse ikisi de userId bazinda iptal edilir", async () => {
    // Bu test, K1 duzeltmesinin gercek senaryosunu kilitler: kullanici hem telefonundan hem
    // laptopundan giris yapmis (iki ayri familyId), telefonundaki token calinip reuse tespit
    // edilir. Case'in "kullanicinin TUM oturumlari sonlandirilir" ifadesi, iptal kriterinin
    // cihaz/aile fark etmeksizin userId'ye gore calismasini gerektirir.
    const userId = "user-multi-device";
    const stolenDeviceFamilyId = "family-phone";
    const { service, refreshTokenRepo } = buildService({
      id: "token-phone",
      tokenHash: "irrelevant",
      userId,
      familyId: stolenDeviceFamilyId,
      usedAt: new Date(),
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    jest.spyOn(service as never, "hashSecret" as never).mockReturnValue("irrelevant" as never);

    await expect(service.refresh("token-phone.secret", null)).rejects.toThrow(/yeniden kullanim tespiti/);

    // Iptal criteria'sinda laptop'un farkli familyId'sinden hic bahsedilmiyor cunku artik
    // userId bazli calisiyor — DB'de o userId'ye ait revokedAt IS NULL olan HER satir (hangi
    // familyId'de olursa olsun) iptal edilir.
    expect(refreshTokenRepo.update).toHaveBeenCalledWith(
      { userId, revokedAt: IsNull() },
      { revokedAt: expect.any(Date) }
    );
  });
});

/**
 * Regresyon testi — register()'in iki teslimat yolunu da dogru davrandigini kilitler:
 * (1) e-posta yapilandirilmisken kod yanitta DONMEMELI (gercekten gonderildi),
 * (2) e-posta yokken/yapilandirilmamisken kod web'de gosterilmeli (otpHint) — ama HER
 * IKI durumda da kod otp_codes tablosuna musteri kaydiyla (userId) iliskili yazilmalidir.
 */
describe("AuthService.register — OTP teslimat yollari", () => {
  it("e-posta yapilandirilmis VE musteri e-posta girmisse: kod yanitta donmez, gercekten gonderilir", async () => {
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x) => ({ ...x, id: "user-1" })),
      save: jest.fn(),
    };
    const otpRepo = { insert: jest.fn().mockResolvedValue(undefined) };
    const auditService = { log: jest.fn() };
    const emailService = { isConfigured: jest.fn().mockReturnValue(true), sendOtp: jest.fn().mockResolvedValue(true) };

    const service = new AuthService(
      userRepo as never,
      {} as never,
      otpRepo as never,
      auditService as never,
      emailService as never
    );

    const result = await service.register({
      gsm: "05551234567",
      name: "Test",
      surname: "User",
      email: "test@example.com",
    } as never);

    expect(result.otpHint).toBeUndefined();
    expect(JSON.stringify(result)).not.toMatch(/\d{4}/);
    expect(emailService.sendOtp).toHaveBeenCalledWith("test@example.com", expect.any(String));
    // Kod, musteri kaydiyla (userId) iliskili sekilde DB'ye yazildi
    expect(otpRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ gsm: "05551234567", userId: "user-1" }));
  });

  it("e-posta yoksa/yapilandirilmamissa: kod web'de gosterilir (otpHint), yine de DB'ye kaydedilir", async () => {
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((x) => ({ ...x, id: "user-2" })),
      save: jest.fn(),
    };
    const otpRepo = { insert: jest.fn().mockResolvedValue(undefined) };
    const auditService = { log: jest.fn() };
    const emailService = { isConfigured: jest.fn().mockReturnValue(false) };

    const service = new AuthService(
      userRepo as never,
      {} as never,
      otpRepo as never,
      auditService as never,
      emailService as never
    );

    const result = await service.register({ gsm: "05551234567", name: "Test", surname: "User" } as never);

    expect(result.otpHint).toEqual(expect.stringMatching(/^\d{4}$/));
    expect(otpRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ gsm: "05551234567", userId: "user-2" }));
  });
});
