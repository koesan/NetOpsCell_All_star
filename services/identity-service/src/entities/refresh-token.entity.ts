import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

// Refresh token'in kendisi DB'de saklanmaz; sadece hash'i saklanir (calinmasi durumunda
// dogrudan kullanilamaz). family_id, rotation zincirini ve reuse-detection'i mumkun kilar.
@Entity("refresh_tokens")
export class RefreshToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "varchar" })
  tokenHash: string;

  @Index()
  @Column({ type: "uuid" })
  familyId: string;

  @Column({ type: "timestamptz", nullable: true })
  usedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  revokedAt: Date | null;

  @Column({ type: "timestamptz" })
  expiresAt: Date;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
