import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { DashboardService } from "./dashboard.service";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../common/enums/enums";

@ApiTags("dashboard")
@Controller("dashboard")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Roles(Role.SUPERVIZOR, Role.ADMIN)
  @Get("summary")
  getSummary() {
    return this.dashboardService.getSummary();
  }
}
