import { Column, Entity, PrimaryColumn, UpdateDateColumn } from "typeorm";

@Entity("user_stats")
export class UserStats {
  @PrimaryColumn({ type: "uuid" })
  userId: string;

  @Column({ type: "int", default: 0 })
  totalPoints: number;

  @Column({ type: "int", default: 0 })
  resolvedCount: number;

  @Column({ type: "int", default: 0 })
  fastResponseCount: number;

  // Ard arda "tekrar eden ariza" bildirimi olmadan cozulen vaka sayisi (Kalici Cozum rozeti icin)
  @Column({ type: "int", default: 0 })
  noRepeatStreak: number;

  @Column({ type: "int", default: 0 })
  criticalWithinSlaCount: number;

  @Column({ type: "date", nullable: true })
  dailyResolvedDate: string | null;

  @Column({ type: "int", default: 0 })
  dailyResolvedCount: number;

  @Column({ type: "jsonb", default: {} })
  resolvedByType: Record<string, number>;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date;
}
