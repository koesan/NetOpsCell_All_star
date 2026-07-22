import "reflect-metadata";
import { DataSource } from "typeorm";
import * as bcrypt from "bcryptjs";
import { User } from "./entities/user.entity";
import { RefreshToken } from "./entities/refresh-token.entity";
import { AuditLog } from "./entities/audit-log.entity";
import { OtpCode } from "./entities/otp-code.entity";
import { Role } from "./common/enums/role.enum";
import { UserStatus } from "./common/enums/user-status.enum";
import { readSecret } from "./common/secrets";

const DEMO_PASSWORD = "Demo123!";

async function seed() {
  const dataSource = new DataSource({
    type: "postgres",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USER || "identity_user",
    password: readSecret("DB_PASSWORD", "changeme"),
    database: process.env.DB_NAME || "identity",
    entities: [User, RefreshToken, AuditLog, OtpCode],
    synchronize: true,
  });

  await dataSource.initialize();
  const userRepo = dataSource.getRepository(User);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const demoUsers: Partial<User>[] = [
    {
      role: Role.ADMIN,
      email: "admin@netopscell.com",
      name: "Ahmet",
      surname: "Yilmaz",
      passwordHash,
      status: UserStatus.ACTIVE,
    },
    {
      role: Role.SUPERVIZOR,
      email: "supervizor@netopscell.com",
      name: "Elif",
      surname: "Kaya",
      passwordHash,
      status: UserStatus.ACTIVE,
    },
    {
      role: Role.NOC_OPERATORU,
      email: "noc@netopscell.com",
      name: "Mehmet",
      surname: "Demir",
      passwordHash,
      status: UserStatus.ACTIVE,
    },
    {
      role: Role.SAHA_TEKNISYENI,
      email: "saha.donanim@netopscell.com",
      name: "Ayse",
      surname: "Sahin",
      passwordHash,
      expertise: ["DONANIM", "ISINMA"],
      region: ["Kadikoy"],
      latitude: 40.9906,
      longitude: 29.0274,
      status: UserStatus.ACTIVE,
    },
    {
      role: Role.SAHA_TEKNISYENI,
      email: "saha.baglanti@netopscell.com",
      name: "Can",
      surname: "Ozturk",
      passwordHash,
      expertise: ["BAGLANTI", "YAZILIM"],
      region: ["Besiktas"],
      latitude: 41.0422,
      longitude: 29.0083,
      status: UserStatus.ACTIVE,
    },
    {
      role: Role.SAHA_TEKNISYENI,
      email: "saha.guc.kesintisi@netopscell.com",
      name: "Zeynep",
      surname: "Arslan",
      passwordHash,
      expertise: ["GUC_KESINTISI"],
      region: ["Uskudar"],
      latitude: 41.0226,
      longitude: 29.0244,
      status: UserStatus.ACTIVE,
    },
    {
      role: Role.MUSTERI,
      gsm: "05551234567",
      name: "Demo",
      surname: "Musteri",
      status: UserStatus.ACTIVE,
    },
  ];

  for (const demoUser of demoUsers) {
    const where = demoUser.email ? { email: demoUser.email } : { gsm: demoUser.gsm as string };
    const existing = await userRepo.findOne({ where });
    if (existing) {
      // eslint-disable-next-line no-console
      console.log(`Atlaniyor (zaten var): ${demoUser.email || demoUser.gsm}`);
      continue;
    }
    await userRepo.save(userRepo.create(demoUser));
    // eslint-disable-next-line no-console
    console.log(`Olusturuldu: ${demoUser.role} - ${demoUser.email || demoUser.gsm}`);
  }

  // eslint-disable-next-line no-console
  console.log(`\nDemo personel sifresi (email ile giris yapanlar icin): ${DEMO_PASSWORD}`);
  // eslint-disable-next-line no-console
  console.log("Demo musteri GSM: 05551234567 (OTP: 1234, simulasyon modu)");

  await dataSource.destroy();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Seed hatasi:", err);
    process.exit(1);
  });
