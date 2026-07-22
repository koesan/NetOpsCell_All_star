import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { IncidentsService } from "./incidents.service";

// Bkz. ARCHITECTURE.md Bolum 4.3 (SLA kurallari) ve case 4.2 (COZULDU -> KAPANDI: "Dogrulama veya 24 saat")
@Injectable()
export class SlaScheduler {
  private readonly logger = new Logger(SlaScheduler.name);

  constructor(private readonly incidentsService: IncidentsService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async checkSlaExceeded() {
    const exceeded = await this.incidentsService.findExceededActiveSla();
    for (const incident of exceeded) {
      await this.incidentsService.markSlaExceeded(incident);
      this.logger.warn(`SLA asildi: ${incident.incidentNo} (${incident.priority})`);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async autoCloseStaleResolved() {
    const stale = await this.incidentsService.findStaleCozuldu();
    for (const incident of stale) {
      await this.incidentsService.autoCloseIncident(incident);
      this.logger.log(`Otomatik kapatildi (24s dogrulama suresi doldu): ${incident.incidentNo}`);
    }
  }
}
