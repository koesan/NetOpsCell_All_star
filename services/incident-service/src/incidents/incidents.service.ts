import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, LessThan, Repository } from "typeorm";

import { Incident } from "../entities/incident.entity";
import { IncidentStatusHistory } from "../entities/incident-status-history.entity";
import { IncidentResolution } from "../entities/incident-resolution.entity";
import { TelemetryReading } from "../entities/telemetry-reading.entity";

import { FaultType, IncidentStatus, Priority, Role, SLA_HOURS } from "../common/enums/enums";
import { AccessTokenPayload } from "../auth/jwt.util";
import { AiClientService } from "../ai-client/ai-client.service";
import { EventPublisherService } from "../common/events/event-publisher.service";
import { MessagingService } from "../messaging/messaging.service";
import { assertValidTransition } from "./state-machine";
import { generateIncidentNo } from "./incident-no.util";

import { CreateTelemetryDto } from "./dto/create-telemetry.dto";
import { UpdateStatusDto } from "./dto/update-status.dto";
import { AssignDto } from "./dto/assign.dto";
import { ClassificationDto } from "./dto/classification.dto";
import { CreateMessageDto } from "./dto/message.dto";
import { CreateResolutionDto, RateResolutionDto } from "./dto/resolution.dto";

const ACTIVE_STATUSES = [
  IncidentStatus.YENI,
  IncidentStatus.ATANDI,
  IncidentStatus.YOLDA,
  IncidentStatus.MUDAHALE_EDILIYOR,
  IncidentStatus.PARCA_BEKLENIYOR,
];

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident) private readonly incidentRepo: Repository<Incident>,
    @InjectRepository(IncidentStatusHistory) private readonly historyRepo: Repository<IncidentStatusHistory>,
    @InjectRepository(IncidentResolution) private readonly resolutionRepo: Repository<IncidentResolution>,
    @InjectRepository(TelemetryReading) private readonly telemetryRepo: Repository<TelemetryReading>,
    private readonly aiClient: AiClientService,
    private readonly eventPublisher: EventPublisherService,
    private readonly messagingService: MessagingService
  ) {}

  private slaDeadlineFor(priority: Priority): Date {
    return new Date(Date.now() + SLA_HOURS[priority] * 60 * 60 * 1000);
  }

  private async recordHistory(
    incidentId: string,
    from: IncidentStatus,
    to: IncidentStatus,
    changedBy: string | null,
    reason?: string
  ) {
    await this.historyRepo.insert({ incidentId, fromStatus: from, toStatus: to, changedBy, reason: reason ?? null });
  }

  private async findPriorTemporaryFix(stationCode: string): Promise<{ incidentNo: string; teamId: string | null } | null> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const row = await this.resolutionRepo
      .createQueryBuilder("resolution")
      .innerJoin(Incident, "incident", "incident.id = resolution.incidentId")
      .select(["incident.incidentNo AS incidentNo", "incident.assignedTeamId AS teamId"])
      .where("incident.stationCode = :stationCode", { stationCode })
      .andWhere("resolution.isPermanent = false")
      .andWhere("resolution.ratedAt >= :since", { since })
      .orderBy("resolution.ratedAt", "DESC")
      .getRawOne<{ incidentno: string; teamid: string | null }>();
    return row ? { incidentNo: row.incidentno, teamId: row.teamid } : null;
  }

  async createTelemetry(dto: CreateTelemetryDto, customerId: string) {
    const telemetry = await this.telemetryRepo.save(
      this.telemetryRepo.create({
        stationCode: dto.stationCode,
        signalStrength: dto.signalStrength,
        packetLoss: dto.packetLoss,
        temperature: dto.temperature,
        powerStatus: dto.powerStatus,
      })
    );

    const prediction = await this.aiClient.predict({
      station_code: dto.stationCode,
      signal_strength: dto.signalStrength,
      packet_loss: dto.packetLoss,
      temperature: dto.temperature,
      power_status: dto.powerStatus,
    });

    // AI Service erisilemez: case 4.1 geregi vaka yine olusturulur (BELIRSIZ / ORTA / manuel kuyruk)
    if (!prediction) {
      const incident = await this.createIncidentRow(dto, customerId, FaultType.BELIRSIZ, Priority.ORTA, null);
      await this.telemetryRepo.update(telemetry.id, { incidentId: incident.id });
      return { incident, aiAvailable: false, message: "AI Service erisilemedi, vaka BELIRSIZ/ORTA ile manuel kuyruga alindi." };
    }

    if (prediction.recommendation === "IZLE") {
      return { incident: null, aiAvailable: true, message: "Olasilik dusuk, sadece izleniyor. Vaka acilmadi.", prediction };
    }

    const faultType = (prediction.fault_type as FaultType) || FaultType.BELIRSIZ;
    const priority = prediction.priority_hint as Priority;
    const incident = await this.createIncidentRow(dto, customerId, faultType, priority, prediction.probability);
    await this.telemetryRepo.update(telemetry.id, { incidentId: incident.id });

    const priorTemporaryFix = await this.findPriorTemporaryFix(dto.stationCode);
    if (priorTemporaryFix) {
      await this.eventPublisher.publish("incident.repeated", {
        incident_id: incident.incidentNo,
        prior_incident_id: priorTemporaryFix.incidentNo,
        team_id: priorTemporaryFix.teamId,
        station_code: dto.stationCode,
        detected_at: new Date().toISOString(),
      });
    }

    if (prediction.recommendation === "ACIL") {
      // >=0.85: sistem otomatik vaka acar VE hemen atama dener (case 5.1, 5.3)
      await this.autoAssign(incident, null);
    }

    return { incident: await this.incidentRepo.findOne({ where: { id: incident.id } }), aiAvailable: true, prediction };
  }

  private async createIncidentRow(
    dto: CreateTelemetryDto,
    customerId: string,
    faultType: FaultType,
    priority: Priority,
    aiProbability: number | null
  ): Promise<Incident> {
    const incident = this.incidentRepo.create({
      incidentNo: generateIncidentNo(),
      stationCode: dto.stationCode,
      latitude: dto.latitude,
      longitude: dto.longitude,
      faultType,
      priority,
      status: IncidentStatus.YENI,
      customerId,
      customerNote: dto.description ?? null,
      complaintAnalysis: dto.complaintAnalysis ?? null,
      aiProbability,
      slaDeadline: this.slaDeadlineFor(priority),
    });
    const saved = await this.incidentRepo.save(incident);
    await this.eventPublisher.publish("incident.created", {
      incident_id: saved.incidentNo,
      station_code: saved.stationCode,
      fault_type: saved.faultType,
      priority: saved.priority,
      created_at: saved.createdAt,
    });
    return saved;
  }

  private async autoAssign(incident: Incident, _actorId: string | null): Promise<void> {
    const assignResult = await this.aiClient.assign({
      incident_id: incident.incidentNo,
      fault_type: incident.faultType,
      priority: incident.priority,
      latitude: incident.latitude,
      longitude: incident.longitude,
    });

    if (!assignResult || assignResult.queued || !assignResult.assigned_team) {
      // Kapasite yok veya AI/Identity/Incident internal aglari gecici erisilemez: vaka kuyrukta (YENI) kalir.
      return;
    }

    const team = assignResult.assigned_team;
    incident.assignedTeamId = team.team_id;
    incident.assignedTeamName = team.name;
    incident.assignedTeamLat = team.team_lat;
    incident.assignedTeamLng = team.team_lng;
    incident.assignmentDetail = {
      method: "AI",
      score: team.score,
      uzmanlik_eslesme: team.uzmanlik_eslesme,
      mesafe_yakinlik: team.mesafe_yakinlik,
      bosluk_orani: team.bosluk_orani,
      distance_km: team.distance_km,
      candidates: assignResult.candidates ?? [],
      candidates_evaluated: assignResult.candidates_evaluated,
    };
    incident.etaTravelMinutes = team.travel_minutes;
    incident.etaWorkMinutes = team.work_minutes;
    incident.etaTotalMinutes = team.total_eta_minutes;
    incident.status = IncidentStatus.ATANDI;
    await this.incidentRepo.save(incident);
    await this.recordHistory(incident.id, IncidentStatus.YENI, IncidentStatus.ATANDI, null, "Otomatik atama (AI)");

    const etaText =
      team.total_eta_minutes != null
        ? ` Tahmini cozum: ~${Math.round(team.total_eta_minutes)} dk (yol ${Math.round(team.travel_minutes ?? 0)} dk + saha ${Math.round(team.work_minutes ?? 0)} dk).`
        : "";
    await this.messagingService.sendSystemMessage(
      incident.id,
      `AI atamasi: ${team.name ?? team.team_id} ekibi gorevlendirildi (skor ${team.score.toFixed(2)}${
        team.distance_km != null ? `, mesafe ${team.distance_km.toFixed(1)} km` : ""
      }).${etaText}`
    );

    await this.eventPublisher.publish("incident.assigned", {
      incident_id: incident.incidentNo,
      team_id: team.team_id,
      team_name: team.name,
      score: team.score,
      distance_km: team.distance_km,
      eta_total_minutes: team.total_eta_minutes,
      assigned_at: new Date().toISOString(),
    });
  }

  /** NOC operatoru VAKA_AC bandindaki (orta guven) bir tahmini dogrulayip sistemin
   * otomatik atama yapmasini tetikler (case 11.2 NOC akisi; case 4.2 "Sistem (AI) / Supervizor"). */
  async confirmAndAutoAssign(incidentId: string, user: AccessTokenPayload) {
    const incident = await this.getOrThrow(incidentId);
    if (incident.status !== IncidentStatus.YENI) {
      throw new UnprocessableEntityException("Sadece YENI durumundaki vakalar onaylanip atanabilir.");
    }
    await this.autoAssign(incident, user.sub);
    return this.getOrThrow(incidentId);
  }

  async findAll(user: AccessTokenPayload) {
    if (user.role === Role.MUSTERI) {
      return this.incidentRepo.find({ where: { customerId: user.sub }, order: { createdAt: "DESC" } });
    }
    if (user.role === Role.SAHA_TEKNISYENI) {
      return this.incidentRepo.find({ where: { assignedTeamId: user.sub }, order: { createdAt: "DESC" } });
    }
    // NOC_OPERATORU, SUPERVIZOR, ADMIN: tum kayitlari gorur
    return this.incidentRepo.find({ order: { createdAt: "DESC" }, take: 200 });
  }

  async getOrThrow(id: string): Promise<Incident> {
    const incident = await this.incidentRepo.findOne({ where: { id } });
    if (!incident) throw new NotFoundException("Vaka bulunamadi.");
    return incident;
  }

  async getResolution(id: string, user: AccessTokenPayload): Promise<IncidentResolution | null> {
    const incident = await this.getOrThrow(id);
    this.assertOwnership(incident, user);
    return this.resolutionRepo.findOne({ where: { incidentId: id } });
  }

  private assertOwnership(incident: Incident, user: AccessTokenPayload) {
    if (user.role === Role.MUSTERI && incident.customerId !== user.sub) {
      throw new ForbiddenException("Bu kaydi goruntuleme yetkiniz yok.");
    }
    if (user.role === Role.SAHA_TEKNISYENI && incident.assignedTeamId !== user.sub) {
      throw new ForbiddenException("Bu kaydi goruntuleme yetkiniz yok.");
    }
  }

  async findOne(id: string, user: AccessTokenPayload): Promise<Incident> {
    const incident = await this.getOrThrow(id);
    this.assertOwnership(incident, user);
    return incident;
  }

  async updateStatus(id: string, dto: UpdateStatusDto, user: AccessTokenPayload): Promise<Incident> {
    const incident = await this.getOrThrow(id);
    this.assertOwnership(incident, user);

    if (dto.status === IncidentStatus.COZULDU) {
      throw new BadRequestException("COZULDU gecisi icin /resolution endpoint'i kullanilmalidir (cozum notu zorunlu).");
    }

    assertValidTransition(incident.status, dto.status, user.role);

    const from = incident.status;
    incident.status = dto.status;
    if (dto.status === IncidentStatus.KAPANDI) {
      incident.closedAt = new Date();
    }
    // Canli saha akisi: yola cikis/varis zaman damgalari haritadaki arac
    // animasyonunun ve gerceklesen-vs-tahmin ETA karsilastirmasinin temelidir.
    if (dto.status === IncidentStatus.YOLDA && !incident.departedAt) {
      incident.departedAt = new Date();
    }
    if (dto.status === IncidentStatus.MUDAHALE_EDILIYOR && from === IncidentStatus.YOLDA && !incident.arrivedAt) {
      incident.arrivedAt = new Date();
    }
    await this.incidentRepo.save(incident);
    await this.recordHistory(incident.id, from, dto.status, user.sub, dto.reason);
    await this.sendTransitionSystemMessage(incident, from, dto.status);
    await this.eventPublisher.publish("incident.status.changed", {
      incident_id: incident.incidentNo,
      from_status: from,
      to_status: dto.status,
      changed_by: user.sub,
      changed_at: new Date().toISOString(),
    });
    return incident;
  }

  async manualAssign(id: string, dto: AssignDto, user: AccessTokenPayload): Promise<Incident> {
    const incident = await this.getOrThrow(id);
    if (incident.status !== IncidentStatus.YENI) {
      throw new UnprocessableEntityException("Sadece YENI durumundaki vakalar manuel atanabilir.");
    }
    const from = incident.status;
    incident.assignedTeamId = dto.teamId;
    incident.assignmentDetail = { method: "MANUEL", assigned_by: user.sub };

    // Manuel atamada da ETA modeli calisir; AI Service kapaliysa atama ETA'siz tamamlanir.
    const estimate = await this.aiClient.estimate({
      fault_type: incident.faultType,
      priority: incident.priority,
      team_id: dto.teamId,
      latitude: incident.latitude,
      longitude: incident.longitude,
    });
    if (estimate) {
      incident.etaTravelMinutes = estimate.travel_minutes;
      incident.etaWorkMinutes = estimate.work_minutes;
      incident.etaTotalMinutes = estimate.total_eta_minutes;
    }

    incident.status = IncidentStatus.ATANDI;
    await this.incidentRepo.save(incident);
    await this.recordHistory(incident.id, from, IncidentStatus.ATANDI, user.sub, "Manuel atama (supervizor)");
    await this.messagingService.sendSystemMessage(
      incident.id,
      `Supervizor tarafindan manuel atama yapildi.${
        estimate ? ` Tahmini cozum: ~${Math.round(estimate.total_eta_minutes)} dk.` : ""
      }`
    );
    await this.eventPublisher.publish("incident.assigned", {
      incident_id: incident.incidentNo,
      team_id: dto.teamId,
      eta_total_minutes: estimate?.total_eta_minutes ?? null,
      assigned_by: user.sub,
      assigned_at: new Date().toISOString(),
    });
    return incident;
  }

  /** Durum gecislerini mesaj thread'ine sistem olayi olarak duser (WhatsApp grup olayi gibi). */
  private async sendTransitionSystemMessage(incident: Incident, from: IncidentStatus, to: IncidentStatus): Promise<void> {
    const teamName = incident.assignedTeamName ?? "Saha ekibi";
    const texts: Partial<Record<IncidentStatus, string>> = {
      [IncidentStatus.YOLDA]: `${teamName} sahaya hareket etti.${
        incident.etaTravelMinutes != null ? ` Tahmini varis: ~${Math.round(incident.etaTravelMinutes)} dk.` : ""
      }`,
      [IncidentStatus.MUDAHALE_EDILIYOR]:
        from === IncidentStatus.PARCA_BEKLENIYOR
          ? "Yedek parca tedarik edildi, mudahale devam ediyor."
          : `${teamName} sahaya ulasti, mudahale basladi.`,
      [IncidentStatus.PARCA_BEKLENIYOR]: "Yedek parca bekleniyor — durum PARCA_BEKLENIYOR'a cekildi.",
      [IncidentStatus.KAPANDI]: "Vaka dogrulandi ve kapatildi.",
    };
    const text = texts[to];
    if (text) await this.messagingService.sendSystemMessage(incident.id, text);
  }

  /** Vaka zaman cizelgesi: durum gecis gecmisi (kim, ne zaman, neden). */
  async getHistory(id: string, user: AccessTokenPayload): Promise<IncidentStatusHistory[]> {
    const incident = await this.getOrThrow(id);
    this.assertOwnership(incident, user);
    return this.historyRepo.find({ where: { incidentId: id }, order: { changedAt: "ASC" } });
  }

  async updateClassification(id: string, dto: ClassificationDto, user: AccessTokenPayload): Promise<Incident> {
    const incident = await this.getOrThrow(id);
    const originalType = incident.faultType;

    if (dto.faultType && dto.faultType !== incident.faultType) {
      incident.faultType = dto.faultType;
      // Faz 2: AI Service'e bildirim artik senkron REST degil, event-tabanli (RabbitMQ tuketici).
      // Boylece AI Service gecici erisilemez olsa da bildirim kaybolmaz (durable queue).
      await this.eventPublisher.publish("incident.type.changed", {
        incident_id: incident.incidentNo,
        original_type: originalType,
        corrected_type: dto.faultType,
        corrected_by: user.sub,
        corrected_at: new Date().toISOString(),
      });
    }

    if (dto.priority && dto.priority !== incident.priority) {
      incident.priority = dto.priority;
      incident.slaDeadline = this.slaDeadlineFor(dto.priority);
    }

    return this.incidentRepo.save(incident);
  }

  async addMessage(id: string, dto: CreateMessageDto, user: AccessTokenPayload) {
    const incident = await this.getOrThrow(id);
    this.assertOwnership(incident, user);
    return this.messagingService.sendMessage(id, user.sub, user.role, dto.content, user.name);
  }

  async getMessages(id: string, user: AccessTokenPayload) {
    const incident = await this.getOrThrow(id);
    this.assertOwnership(incident, user);
    return this.messagingService.getThread(id);
  }

  async markMessagesRead(id: string, user: AccessTokenPayload) {
    const incident = await this.getOrThrow(id);
    this.assertOwnership(incident, user);
    const updated = await this.messagingService.markThreadRead(id, user.sub);
    return { markedRead: updated };
  }

  async createResolution(id: string, dto: CreateResolutionDto, user: AccessTokenPayload): Promise<Incident> {
    const incident = await this.getOrThrow(id);
    this.assertOwnership(incident, user);

    if (incident.status !== IncidentStatus.MUDAHALE_EDILIYOR) {
      throw new UnprocessableEntityException("Cozum notu sadece MUDAHALE_EDILIYOR durumundaki vakalar icin girilebilir.");
    }

    await this.resolutionRepo.save(this.resolutionRepo.create({ incidentId: id, resolutionNote: dto.resolutionNote }));

    const from = incident.status;
    incident.status = IncidentStatus.COZULDU;
    incident.resolvedAt = new Date();
    await this.incidentRepo.save(incident);
    await this.recordHistory(incident.id, from, IncidentStatus.COZULDU, user.sub, "Cozum notu girildi");
    await this.messagingService.sendSystemMessage(
      incident.id,
      `Vaka cozuldu olarak isaretlendi. Cozum notu: "${dto.resolutionNote.slice(0, 120)}"`
    );

    const elapsedMs = incident.resolvedAt.getTime() - incident.createdAt.getTime();
    const slaMs = SLA_HOURS[incident.priority] * 60 * 60 * 1000;
    const withinHalfSla = elapsedMs <= slaMs / 2;
    const withinSla = elapsedMs <= slaMs;

    await this.eventPublisher.publish("incident.resolved", {
      incident_id: incident.incidentNo,
      team_id: incident.assignedTeamId,
      fault_type: incident.faultType,
      priority: incident.priority,
      created_at: incident.createdAt.toISOString(),
      resolved_at: incident.resolvedAt.toISOString(),
      within_half_sla: withinHalfSla,
      within_sla: withinSla,
    });

    return incident;
  }

  async rateResolution(id: string, dto: RateResolutionDto, user: AccessTokenPayload): Promise<IncidentResolution> {
    const incident = await this.getOrThrow(id);
    if (incident.status !== IncidentStatus.KAPANDI) {
      throw new UnprocessableEntityException("Degerlendirme sadece KAPANDI durumundaki vakalar icin yapilabilir.");
    }

    const resolution = await this.resolutionRepo.findOne({ where: { incidentId: id } });
    if (!resolution) throw new NotFoundException("Bu vakaya ait cozum notu bulunamadi.");
    if (resolution.ratedAt) {
      throw new BadRequestException("Bu vaka zaten degerlendirilmis. Degerlendirme tek seferliktir.");
    }

    resolution.rating = dto.rating;
    resolution.isPermanent = dto.isPermanent;
    resolution.ratedBy = user.sub;
    resolution.ratedAt = new Date();
    await this.resolutionRepo.save(resolution);

    await this.eventPublisher.publish("incident.resolution.rated", {
      incident_id: incident.incidentNo,
      team_id: incident.assignedTeamId,
      rating: dto.rating,
      is_permanent: dto.isPermanent,
      rated_by: user.sub,
      rated_at: resolution.ratedAt.toISOString(),
    });

    return resolution;
  }

  // Zamanlanmis gorevler (SLA asimi + 24 saat sonrasi otomatik kapama) icin (bkz. sla.scheduler.ts)
  async findExceededActiveSla(): Promise<Incident[]> {
    return this.incidentRepo.find({
      where: {
        status: In(ACTIVE_STATUSES),
        slaDeadline: LessThan(new Date()),
        slaExceededNotified: false,
      },
    });
  }

  async markSlaExceeded(incident: Incident): Promise<void> {
    incident.slaExceededNotified = true;
    await this.incidentRepo.save(incident);
    await this.eventPublisher.publish("incident.sla.exceeded", {
      incident_id: incident.incidentNo,
      team_id: incident.assignedTeamId,
      priority: incident.priority,
      sla_deadline: incident.slaDeadline?.toISOString(),
      exceeded_at: new Date().toISOString(),
    });
  }

  async findStaleCozuldu(): Promise<Incident[]> {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.incidentRepo.find({
      where: { status: IncidentStatus.COZULDU, resolvedAt: LessThan(cutoff) },
    });
  }

  async autoCloseIncident(incident: Incident): Promise<void> {
    const from = incident.status;
    incident.status = IncidentStatus.KAPANDI;
    incident.closedAt = new Date();
    await this.incidentRepo.save(incident);
    await this.recordHistory(incident.id, from, IncidentStatus.KAPANDI, null, "Otomatik kapama (24 saat)");
  }

  async getWorkloadByTeam(): Promise<Record<string, number>> {
    const rows = await this.incidentRepo
      .createQueryBuilder("incident")
      .select("incident.assignedTeamId", "teamId")
      .addSelect("COUNT(*)", "count")
      .where("incident.status IN (:...statuses)", { statuses: ACTIVE_STATUSES })
      .andWhere("incident.assignedTeamId IS NOT NULL")
      .groupBy("incident.assignedTeamId")
      .getRawMany<{ teamId: string; count: string }>();

    return Object.fromEntries(rows.map((r) => [r.teamId, parseInt(r.count, 10)]));
  }
}
