import { Controller, Get, UseGuards } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { User } from "../entities/user.entity";
import { Role } from "../common/enums/role.enum";
import { Public } from "../common/decorators/public.decorator";
import { InternalApiKeyGuard } from "../common/guards/internal-api-key.guard";

@Controller("internal")
@Public()
@UseGuards(InternalApiKeyGuard)
export class InternalController {
  constructor(@InjectRepository(User) private readonly userRepo: Repository<User>) {}

  // AI Service'in team_cache'ini besler (bkz. ARCHITECTURE.md Bolum 4.4, EVENTS.md team.profile.updated)
  @Get("teams")
  async listTeams() {
    const teams = await this.userRepo.find({
      where: { role: In([Role.SAHA_TEKNISYENI]) },
    });
    return teams.map((t) => ({
      team_id: t.id,
      name: `${t.name} ${t.surname}`,
      expertise: t.expertise ?? [],
      region: t.region ?? [],
      lat: t.latitude,
      lng: t.longitude,
    }));
  }
}
