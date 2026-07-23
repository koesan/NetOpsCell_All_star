import { AdminService } from "./admin.service";
import { Role } from "../common/enums/role.enum";
import { UserStatus } from "../common/enums/user-status.enum";

describe("AdminService", () => {
  let service: AdminService;
  let mockUserRepo: any;
  let mockAuditService: any;
  let mockEventPublisher: any;

  const sampleUser = {
    id: "user-100",
    role: Role.SAHA_TEKNISYENI,
    email: "teknisyen@netopscell.com",
    gsm: null,
    passwordHash: "$2a$10$hashed",
    name: "Ahmet",
    surname: "Yılmaz",
    expertise: ["DONANIM", "BAGLANTI"],
    region: ["Kadıköy", "Üsküdar"],
    latitude: 40.99,
    longitude: 29.02,
    status: UserStatus.ACTIVE,
    failedLoginCount: 0,
    lockedUntil: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockUserRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: "user-new-1" })),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };

    mockAuditService = {
      log: jest.fn().mockResolvedValue(undefined),
      list: jest.fn().mockResolvedValue([]),
    };

    mockEventPublisher = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    service = new AdminService(mockUserRepo, mockAuditService, mockEventPublisher);
  });

  it("yeni personel hesabi olusturur ve audit log kaydi atar", async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    const result = await service.createPersonnel(
      {
        name: "Mehmet",
        surname: "Demir",
        email: "mehmet@netopscell.com",
        password: "Password1!",
        role: Role.NOC_OPERATORU,
        expertise: ["YAZILIM"],
        region: ["Maslak"],
      },
      "admin-id"
    );

    expect(result.email).toBe("mehmet@netopscell.com");
    expect(result.role).toBe(Role.NOC_OPERATORU);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "PERSONEL_HESABI_OLUSTURULDU" })
    );
    expect(mockEventPublisher.publish).toHaveBeenCalledWith("team.profile.updated", expect.any(Object));
  });

  it("personel bilgilerini gunceller (rol, uzmanlik, bolge)", async () => {
    mockUserRepo.findOne.mockResolvedValue({ ...sampleUser });

    const updated = await service.updatePersonnel(
      "user-100",
      {
        name: "Ahmet Can",
        role: Role.SUPERVIZOR,
        expertise: ["DONANIM", "ISINMA"],
        region: ["Ataşehir", "Kadıköy"],
      },
      "admin-id"
    );

    expect(updated.name).toBe("Ahmet Can");
    expect(updated.role).toBe(Role.SUPERVIZOR);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "PERSONEL_GUNCELLENDI" })
    );
  });

  it("personeli pasife alir (silme islemi)", async () => {
    mockUserRepo.findOne.mockResolvedValue({ ...sampleUser });

    const res = await service.deletePersonnel("user-100", "admin-id");
    expect(res.deleted).toBe(true);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "PERSONEL_PASIFE_ALINDI" })
    );
  });
});
