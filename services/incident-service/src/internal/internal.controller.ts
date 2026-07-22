import { Controller, Get, UseGuards } from "@nestjs/common";
import { IncidentsService } from "../incidents/incidents.service";
import { Public } from "../common/decorators/public.decorator";
import { InternalApiKeyGuard } from "../common/guards/internal-api-key.guard";

@Controller("internal")
@Public()
@UseGuards(InternalApiKeyGuard)
export class InternalController {
  constructor(private readonly incidentsService: IncidentsService) {}

  // AI Service'in bosluk_orani hesabi icin ekip basina aktif vaka sayisi (bkz. ARCHITECTURE.md Bolum 9.2)
  @Get("teams/workload")
  async getWorkload() {
    return this.incidentsService.getWorkloadByTeam();
  }
}
