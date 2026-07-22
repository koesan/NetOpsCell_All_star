import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";
import { FaultType, IncidentStatus, Priority } from "../common/enums/enums";

@Entity("incidents")
export class Incident {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index({ unique: true })
  @Column({ type: "varchar" })
  incidentNo: string;

  @Column({ type: "varchar" })
  stationCode: string;

  @Column({ type: "float", nullable: true })
  latitude: number | null;

  @Column({ type: "float", nullable: true })
  longitude: number | null;

  @Column({ type: "enum", enum: FaultType, default: FaultType.BELIRSIZ })
  faultType: FaultType;

  @Column({ type: "enum", enum: Priority, default: Priority.ORTA })
  priority: Priority;

  @Column({ type: "enum", enum: IncidentStatus, default: IncidentStatus.YENI })
  status: IncidentStatus;

  @Index()
  @Column({ type: "uuid" })
  customerId: string;

  @Column({ type: "uuid", nullable: true })
  assignedTeamId: string | null;

  @Column({ type: "float", nullable: true })
  aiProbability: number | null;

  @Column({ type: "timestamptz", nullable: true })
  slaDeadline: Date | null;

  @Column({ type: "boolean", default: false })
  slaExceededNotified: boolean;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;

  @Column({ type: "timestamptz", nullable: true })
  resolvedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  closedAt: Date | null;
}
