import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { GamificationService } from "./gamification.service";

@ApiTags("game")
@Controller("game")
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get("leaderboard")
  getLeaderboard(@Query("period") period: "daily" | "weekly" = "daily") {
    return this.gamificationService.getLeaderboard(period === "weekly" ? "weekly" : "daily");
  }

  @Get("profile/:userId")
  getProfile(@Param("userId") userId: string) {
    return this.gamificationService.getProfile(userId);
  }

  @Get("badges")
  getBadges() {
    return this.gamificationService.getBadgeCatalog();
  }
}
