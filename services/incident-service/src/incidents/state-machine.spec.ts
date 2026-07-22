import { UnprocessableEntityException } from "@nestjs/common";
import { IncidentStatus, Role } from "../common/enums/enums";
import { assertValidTransition, isValidTransition } from "./state-machine";

describe("state-machine", () => {
  const legalPath: [IncidentStatus, IncidentStatus, Role][] = [
    [IncidentStatus.YENI, IncidentStatus.ATANDI, Role.SUPERVIZOR],
    [IncidentStatus.ATANDI, IncidentStatus.YOLDA, Role.SAHA_TEKNISYENI],
    [IncidentStatus.YOLDA, IncidentStatus.MUDAHALE_EDILIYOR, Role.SAHA_TEKNISYENI],
    [IncidentStatus.MUDAHALE_EDILIYOR, IncidentStatus.PARCA_BEKLENIYOR, Role.SAHA_TEKNISYENI],
    [IncidentStatus.PARCA_BEKLENIYOR, IncidentStatus.MUDAHALE_EDILIYOR, Role.SAHA_TEKNISYENI],
    [IncidentStatus.MUDAHALE_EDILIYOR, IncidentStatus.COZULDU, Role.SAHA_TEKNISYENI],
    [IncidentStatus.COZULDU, IncidentStatus.KAPANDI, Role.NOC_OPERATORU],
  ];

  it.each(legalPath)("%s -> %s gecisine %s rolu izinlidir", (from, to, role) => {
    expect(isValidTransition(from, to, role)).toBe(true);
    expect(() => assertValidTransition(from, to, role)).not.toThrow();
  });

  it("SUPERVIZOR her tanimli gecisi yapabilir (ATANDI -> YOLDA)", () => {
    expect(isValidTransition(IncidentStatus.ATANDI, IncidentStatus.YOLDA, Role.SUPERVIZOR)).toBe(true);
  });

  it("adim atlama (YENI -> MUDAHALE_EDILIYOR) her zaman gecersizdir", () => {
    expect(isValidTransition(IncidentStatus.YENI, IncidentStatus.MUDAHALE_EDILIYOR, Role.SAHA_TEKNISYENI)).toBe(false);
    expect(() => assertValidTransition(IncidentStatus.YENI, IncidentStatus.MUDAHALE_EDILIYOR, Role.SAHA_TEKNISYENI)).toThrow(
      UnprocessableEntityException
    );
  });

  it("yetkisiz rol gecisi reddedilir (MUSTERI, ATANDI -> YOLDA yapamaz)", () => {
    expect(isValidTransition(IncidentStatus.ATANDI, IncidentStatus.YOLDA, Role.MUSTERI)).toBe(false);
  });

  it("NOC_OPERATORU sahaya ait bir gecisi (ATANDI -> YOLDA) yapamaz", () => {
    expect(isValidTransition(IncidentStatus.ATANDI, IncidentStatus.YOLDA, Role.NOC_OPERATORU)).toBe(false);
  });

  it("geriye donus (COZULDU -> MUDAHALE_EDILIYOR) tanimli degildir", () => {
    expect(isValidTransition(IncidentStatus.COZULDU, IncidentStatus.MUDAHALE_EDILIYOR, Role.SAHA_TEKNISYENI)).toBe(false);
  });

  it("KAPANDI durumundan hicbir gecis tanimli degildir (terminal durum)", () => {
    expect(isValidTransition(IncidentStatus.KAPANDI, IncidentStatus.YENI, Role.ADMIN)).toBe(false);
    expect(isValidTransition(IncidentStatus.KAPANDI, IncidentStatus.ATANDI, Role.SUPERVIZOR)).toBe(false);
  });

  it("assertValidTransition hatasi rol ve durumlari mesajda belirtir", () => {
    try {
      assertValidTransition(IncidentStatus.YENI, IncidentStatus.KAPANDI, Role.MUSTERI);
      fail("hata beklenirken firlatilmadi");
    } catch (err) {
      expect(err).toBeInstanceOf(UnprocessableEntityException);
      expect((err as Error).message).toContain("YENI");
      expect((err as Error).message).toContain("KAPANDI");
      expect((err as Error).message).toContain("MUSTERI");
    }
  });
});
