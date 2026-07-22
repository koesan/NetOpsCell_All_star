import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { IncidentStatus } from "../common/enums/enums";

@Entity("incident_status_history")
export class IncidentStatusHistory {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ type: "uuid" })
  incidentId: string;

  @Column({ type: "enum", enum: IncidentStatus })
  fromStatus: IncidentStatus;

  @Column({ type: "enum", enum: IncidentStatus })
  toStatus: IncidentStatus;

  @Column({ type: "uuid", nullable: true })
  changedBy: string | null;

  @Column({ type: "varchar", nullable: true })
  reason: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  changedAt: Date;
}
