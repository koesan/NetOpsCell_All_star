import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("otp_codes")
export class OtpCode {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ type: "varchar" })
  gsm: string;

  /** Kaydin hangi musteri hesabina ait oldugunu acikca isaretler (gsm zaten benzersiz
   * tanimlayici olsa da, sorgularda/loglarda dogrudan iliski icin ayrica tutulur). */
  @Index()
  @Column({ type: "uuid", nullable: true })
  userId: string | null;

  @Column({ type: "varchar" })
  code: string;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  verifiedAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
