import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("incident_resolutions")
export class IncidentResolution {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index({ unique: true })
  @Column({ type: "uuid" })
  incidentId: string;

  @Column({ type: "text" })
  resolutionNote: string;

  @Column({ type: "uuid", nullable: true })
  ratedBy: string | null;

  @Column({ type: "int", nullable: true })
  rating: number | null;

  @Column({ type: "boolean", nullable: true })
  isPermanent: boolean | null;

  @Column({ type: "timestamptz", nullable: true })
  ratedAt: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
