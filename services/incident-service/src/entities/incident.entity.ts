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

  @Column({ type: "varchar", nullable: true })
  assignedTeamName: string | null;

  // Ekibin cikis noktasi (ussu) — haritadaki rota cizimi ve canli ilerleme animasyonunun baslangici
  @Column({ type: "float", nullable: true })
  assignedTeamLat: number | null;

  @Column({ type: "float", nullable: true })
  assignedTeamLng: number | null;

  /** AI atama skor kirilimi: { score, uzmanlik_eslesme, mesafe_yakinlik, bosluk_orani,
   * distance_km, candidates: [...] } — supervizor "neden bu ekip?" paneli icin. */
  @Column({ type: "jsonb", nullable: true })
  assignmentDetail: Record<string, unknown> | null;

  // ETA modeli (AI Service'teki ikinci ML modeli, regresyon) ciktilari — dakika cinsinden
  @Column({ type: "float", nullable: true })
  etaTravelMinutes: number | null;

  @Column({ type: "float", nullable: true })
  etaWorkMinutes: number | null;

  @Column({ type: "float", nullable: true })
  etaTotalMinutes: number | null;

  // Canli saha akisi zaman damgalari: YOLDA gecisinde departedAt, sahaya varista arrivedAt
  @Column({ type: "timestamptz", nullable: true })
  departedAt: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  arrivedAt: Date | null;

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
