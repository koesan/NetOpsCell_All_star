import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from "typeorm";

@Entity("audit_logs")
export class AuditLog {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "uuid", nullable: true })
  userId: string | null;

  @Column({ type: "varchar" })
  actionType: string;

  @Column({ type: "varchar", nullable: true })
  ip: string | null;

  @Column({ type: "varchar" })
  result: "SUCCESS" | "FAILURE";

  @Column({ type: "jsonb", nullable: true })
  detail: Record<string, unknown> | null;

  @CreateDateColumn({ type: "timestamptz" })
  timestamp: Date;
}
