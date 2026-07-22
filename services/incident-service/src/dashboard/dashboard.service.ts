import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { Incident } from "../entities/incident.entity";
import { IncidentResolution } from "../entities/incident-resolution.entity";
import { IncidentStatus } from "../common/enums/enums";

const ACTIVE_STATUSES = [
  IncidentStatus.YENI,
  IncidentStatus.ATANDI,
  IncidentStatus.YOLDA,
  IncidentStatus.MUDAHALE_EDILIYOR,
  IncidentStatus.PARCA_BEKLENIYOR,
];

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Incident) private readonly incidentRepo: Repository<Incident>,
    @InjectRepository(IncidentResolution) private readonly resolutionRepo: Repository<IncidentResolution>
  ) {}

  private async faultTypeDistribution() {
    return this.incidentRepo
      .createQueryBuilder("incident")
      .select("incident.faultType", "faultType")
      .addSelect("COUNT(*)", "count")
      .groupBy("incident.faultType")
      .getRawMany();
  }

  private async priorityDistribution() {
    return this.incidentRepo
      .createQueryBuilder("incident")
      .select("incident.priority", "priority")
      .addSelect("COUNT(*)", "count")
      .groupBy("incident.priority")
      .getRawMany();
  }

  private async slaSummary() {
    const totalResolved = await this.incidentRepo.count({
      where: { status: In([IncidentStatus.COZULDU, IncidentStatus.KAPANDI]) },
    });
    const exceededResolved = await this.incidentRepo.count({
      where: { status: In([IncidentStatus.COZULDU, IncidentStatus.KAPANDI]), slaExceededNotified: true },
    });
    const complianceRate = totalResolved > 0 ? Math.round(((totalResolved - exceededResolved) / totalResolved) * 10000) / 100 : 100;

    const exceededActive = await this.incidentRepo.find({
      where: { status: In(ACTIVE_STATUSES), slaExceededNotified: true },
      order: { slaDeadline: "ASC" },
    });

    return { complianceRatePercent: complianceRate, totalResolved, exceededActiveCount: exceededActive.length, exceededActive };
  }

  private async fieldTeamPerformance() {
    const rows = await this.incidentRepo
      .createQueryBuilder("incident")
      .select("incident.assignedTeamId", "teamId")
      .addSelect("COUNT(*)", "resolvedCount")
      .addSelect("AVG(EXTRACT(EPOCH FROM (incident.resolvedAt - incident.createdAt)))", "avgResponseSeconds")
      .where("incident.status IN (:...statuses)", { statuses: [IncidentStatus.COZULDU, IncidentStatus.KAPANDI] })
      .andWhere("incident.assignedTeamId IS NOT NULL")
      .groupBy("incident.assignedTeamId")
      .getRawMany<{ teamId: string; resolvedCount: string; avgResponseSeconds: string | null }>();

    const repeatRows = await this.resolutionRepo
      .createQueryBuilder("resolution")
      .innerJoin(Incident, "incident", "incident.id = resolution.incidentId")
      .select("incident.assignedTeamId", "teamId")
      .addSelect("COUNT(*) FILTER (WHERE resolution.isPermanent = false)", "temporaryCount")
      .addSelect("COUNT(*)", "totalRated")
      .where("resolution.ratedAt IS NOT NULL")
      .groupBy("incident.assignedTeamId")
      .getRawMany<{ teamId: string; temporaryCount: string; totalRated: string }>();

    const repeatByTeam = Object.fromEntries(
      repeatRows.map((r) => [r.teamId, r.totalRated !== "0" ? Math.round((parseInt(r.temporaryCount, 10) / parseInt(r.totalRated, 10)) * 10000) / 100 : 0])
    );

    return rows.map((r) => ({
      teamId: r.teamId,
      resolvedCount: parseInt(r.resolvedCount, 10),
      avgResponseSeconds: r.avgResponseSeconds ? Math.round(parseFloat(r.avgResponseSeconds)) : null,
      repeatRatePercent: repeatByTeam[r.teamId] ?? 0,
    }));
  }

  private async pendingAssignmentQueue() {
    return this.incidentRepo.find({
      where: { status: IncidentStatus.YENI },
      order: { createdAt: "ASC" },
    });
  }

  async getSummary() {
    const [faultTypeDistribution, priorityDistribution, sla, fieldTeamPerformance, pendingAssignmentQueue] = await Promise.all([
      this.faultTypeDistribution(),
      this.priorityDistribution(),
      this.slaSummary(),
      this.fieldTeamPerformance(),
      this.pendingAssignmentQueue(),
    ]);

    return {
      faultTypeDistribution,
      priorityDistribution,
      sla,
      fieldTeamPerformance,
      pendingAssignmentQueue,
    };
  }
}
