import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { GamificationService } from "../gamification/gamification.service";
import { Public } from "../common/decorators/public.decorator";
import { InternalApiKeyGuard } from "../common/guards/internal-api-key.guard";

/**
 * Faz 1 test kancasi: gercek RabbitMQ tuketimi henuz baglanmadigi icin (bkz. ARCHITECTURE.md
 * Bolum 7, Faz 2), Incident Service'in yayinladigi event'ler bu endpoint araciligiyla manuel/test
 * amacli tetiklenebilir. Faz 2'de bu endpoint yerini gercek bir RabbitMQ consumer'a birakacak;
 * cagirdigi GamificationService metodlari degismeyecek.
 */
@Controller("internal")
@Public()
@UseGuards(InternalApiKeyGuard)
export class InternalController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Post("simulate-event")
  async simulateEvent(@Body() body: { event_type: string; payload: Record<string, unknown> }) {
    switch (body.event_type) {
      case "incident.resolved":
        return this.gamificationService.handleIncidentResolved(body.payload as never);
      case "incident.resolution.rated":
        return this.gamificationService.handleResolutionRated(body.payload as never);
      case "incident.sla.exceeded":
        return this.gamificationService.handleSlaExceeded(body.payload as never);
      case "incident.repeated":
        return this.gamificationService.handleIncidentRepeated(body.payload as never);
      default:
        return { message: `Bilinmeyen event_type: ${body.event_type}` };
    }
  }
}
