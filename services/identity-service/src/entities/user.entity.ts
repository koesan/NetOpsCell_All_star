import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";
import { Role } from "../common/enums/role.enum";
import { UserStatus } from "../common/enums/user-status.enum";

@Entity("users")
export class User {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "enum", enum: Role })
  role: Role;

  @Index({ unique: true, where: '"email" IS NOT NULL' })
  @Column({ type: "varchar", nullable: true })
  email: string | null;

  @Index({ unique: true, where: '"gsm" IS NOT NULL' })
  @Column({ type: "varchar", nullable: true })
  gsm: string | null;

  @Column({ type: "varchar", nullable: true })
  passwordHash: string | null;

  @Column({ type: "varchar" })
  name: string;

  @Column({ type: "varchar" })
  surname: string;

  // Personel icin uzmanlik alanlari (orn. ["DONANIM","ISINMA"])
  @Column({ type: "simple-array", nullable: true })
  expertise: string[] | null;

  // Personel icin bolge/atama alanlari (orn. ["Kadikoy","Uskudar"])
  @Column({ type: "simple-array", nullable: true })
  region: string[] | null;

  // Saha ekibi konumu (akilli atama mesafe hesabi icin) - Admin tarafindan atanir
  @Column({ type: "float", nullable: true })
  latitude: number | null;

  @Column({ type: "float", nullable: true })
  longitude: number | null;

  @Column({ type: "enum", enum: UserStatus, default: UserStatus.ACTIVE })
  status: UserStatus;

  @Column({ type: "int", default: 0 })
  failedLoginCount: number;

  @Column({ type: "timestamptz", nullable: true })
  lockedUntil: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
