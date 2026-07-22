import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

/** Musteri GSM numarasi <-> Telegram sohbet ID eslemesi. Gercek OTP teslimati icin kullanilir:
 * musteri once bir defaya mahsus Telegram botunu /start <linkToken> ile baslatir, bundan sonraki
 * tum OTP kodlari o sohbete gercekten gonderilir (bkz. telegram.service.ts). */
@Entity("telegram_links")
export class TelegramLink {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index({ unique: true })
  @Column({ type: "varchar" })
  gsm: string;

  @Index({ unique: true })
  @Column({ type: "varchar" })
  linkToken: string;

  @Column({ type: "varchar", nullable: true })
  chatId: string | null;

  @Column({ type: "timestamptz", nullable: true })
  linkedAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
