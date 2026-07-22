import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("points_ledger")
export class PointsLedger {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ type: "uuid" })
  userId: string;

  @Column({ type: "varchar", nullable: true })
  incidentId: string | null;

  @Column({ type: "int" })
  points: number;

  @Column({ type: "varchar" })
  reason: string;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
