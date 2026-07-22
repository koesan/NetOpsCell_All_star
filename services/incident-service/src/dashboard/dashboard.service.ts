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

  /** Case 7: "Öncelik dağılımı VE TREND". Son 14 gunun gunluk oncelik kirilimini doner —
   * frontend'de yigilmis (stacked) alan grafigi olarak gosterilir. Gun bazinda pivotlanmis
   * satirlar doner: { day: 'YYYY-MM-DD', KRITIK: n, YUKSEK: n, ORTA: n, DUSUK: n }. */
  private async priorityTrend() {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const rows = await this.incidentRepo
      .createQueryBuilder("incident")
      .select("TO_CHAR(incident.createdAt, 'YYYY-MM-DD')", "day")
      .addSelect("incident.priority", "priority")
      .addSelect("COUNT(*)", "count")
      .where("incident.createdAt >= :since", { since })
      .groupBy("day")
      .addGroupBy("incident.priority")
      .orderBy("day", "ASC")
      .getRawMany<{ day: string; priority: string; count: string }>();

    const byDay = new Map<string, Record<string, number>>();
    for (const row of rows) {
      const entry = byDay.get(row.day) ?? { KRITIK: 0, YUKSEK: 0, ORTA: 0, DUSUK: 0 };
      entry[row.priority] = parseInt(row.count, 10);
      byDay.set(row.day, entry);
    }
    return Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, counts]) => ({ day, ...counts }));
  }

  private async slaSummary() {
    const totalResolved = await this.incidentRepo.count({
      where: { status: In([IncidentStatus.COZULDU, IncidentStatus.KAPANDI]) },
    });
    const exceededResolved = await this.incidentRepo.count({
      where: { status: In([IncidentStatus.COZULDU, IncidentStatus.KAPANDI]), slaExceededNotified: true },
    });
    const complianceRate = totalResolved > 0 ? Math.round(((totalResolved - exceededResolved) / totalResolved) * 10000) / 100 : 100;

    // Case 4.4: "KRITIK vaka kirmizi isaretlenir, supervizor panelinde EN USTTE gorunur" —
    // oncelik sirasina gore (KRITIK ilk) siralanir, ayni oncelikte en cok gecikmis olan ustte.
    const priorityRank = "CASE incident.priority WHEN 'KRITIK' THEN 0 WHEN 'YUKSEK' THEN 1 WHEN 'ORTA' THEN 2 ELSE 3 END";
    const exceededActive = await this.incidentRepo
      .createQueryBuilder("incident")
      .where("incident.status IN (:...statuses)", { statuses: ACTIVE_STATUSES })
      .andWhere("incident.slaExceededNotified = true")
      .orderBy(priorityRank, "ASC")
      .addOrderBy("incident.slaDeadline", "ASC")
      .getMany();

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
    const [faultTypeDistribution, priorityDistribution, priorityTrend, sla, fieldTeamPerformance, pendingAssignmentQueue] =
      await Promise.all([
        this.faultTypeDistribution(),
        this.priorityDistribution(),
        this.priorityTrend(),
        this.slaSummary(),
        this.fieldTeamPerformance(),
        this.pendingAssignmentQueue(),
      ]);

    return {
      faultTypeDistribution,
      priorityDistribution,
      priorityTrend,
      sla,
      fieldTeamPerformance,
      pendingAssignmentQueue,
    };
  }
}
