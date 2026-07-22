import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity("telemetry_readings")
export class TelemetryReading {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ type: "varchar" })
  stationCode: string;

  @Column({ type: "float" })
  signalStrength: number;

  @Column({ type: "float" })
  packetLoss: number;

  @Column({ type: "float" })
  temperature: number;

  @Column({ type: "varchar" })
  powerStatus: string;

  @Column({ type: "uuid", nullable: true })
  incidentId: string | null;

  @CreateDateColumn({ type: "timestamptz" })
  receivedAt: Date;
}
