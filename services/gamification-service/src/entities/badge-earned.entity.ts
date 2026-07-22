import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { BadgeCode } from "../common/enums/enums";

@Entity("badges_earned")
@Index(["userId", "badgeCode"], { unique: true })
export class BadgeEarned {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "enum", enum: BadgeCode })
  badgeCode: BadgeCode;

  @CreateDateColumn({ type: "timestamptz" })
  earnedAt: Date;
}
