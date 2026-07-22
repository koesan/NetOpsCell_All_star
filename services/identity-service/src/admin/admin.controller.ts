import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { CreatePersonnelDto } from "./dto/create-personnel.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../common/enums/role.enum";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AccessTokenPayload } from "../auth/jwt.util";

@ApiTags("admin")
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles(Role.ADMIN)
  @Post("personnel")
  createPersonnel(@Body() dto: CreatePersonnelDto, @CurrentUser() user: AccessTokenPayload) {
    return this.adminService.createPersonnel(dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Get("personnel")
  listPersonnel() {
    return this.adminService.listPersonnel();
  }

  @Roles(Role.ADMIN)
  @Patch("personnel/:id/role")
  updateRole(@Param("id") id: string, @Body() dto: UpdateRoleDto, @CurrentUser() user: AccessTokenPayload) {
    return this.adminService.updateRole(id, dto, user.sub);
  }

  @Roles(Role.ADMIN)
  @Get("audit-logs")
  listAuditLogs(@Query("limit") limit?: string) {
    return this.adminService.listAuditLogs(limit ? parseInt(limit, 10) : 100);
  }
}
