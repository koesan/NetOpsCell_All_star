import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { IncidentsService } from "./incidents.service";
import { CreateTelemetryDto } from "./dto/create-telemetry.dto";
import { UpdateStatusDto } from "./dto/update-status.dto";
import { AssignDto } from "./dto/assign.dto";
import { ClassificationDto } from "./dto/classification.dto";
import { CreateMessageDto } from "./dto/message.dto";
import { CreateResolutionDto, RateResolutionDto } from "./dto/resolution.dto";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../common/enums/enums";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AccessTokenPayload } from "../auth/jwt.util";

const PERSONEL_VE_SUPERVIZOR = [Role.SAHA_TEKNISYENI, Role.NOC_OPERATORU, Role.SUPERVIZOR];

@ApiTags("incidents")
@Controller()
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Roles(Role.MUSTERI, Role.SAHA_TEKNISYENI, Role.NOC_OPERATORU, Role.SUPERVIZOR, Role.ADMIN)
  @Post("telemetry")
  createTelemetry(@Body() dto: CreateTelemetryDto, @CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.createTelemetry(dto, user.sub);
  }

  @Get("incidents")
  findAll(@CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.findAll(user);
  }

  @Get("incidents/:id")
  findOne(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.findOne(id, user);
  }

  @Get("incidents/:id/history")
  getHistory(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.getHistory(id, user);
  }

  @Roles(...PERSONEL_VE_SUPERVIZOR)
  @Patch("incidents/:id/status")
  updateStatus(@Param("id") id: string, @Body() dto: UpdateStatusDto, @CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.updateStatus(id, dto, user);
  }

  @Roles(Role.SUPERVIZOR)
  @Patch("incidents/:id/assign")
  manualAssign(@Param("id") id: string, @Body() dto: AssignDto, @CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.manualAssign(id, dto, user);
  }

  @Roles(Role.NOC_OPERATORU, Role.SUPERVIZOR)
  @Post("incidents/:id/confirm")
  confirmAndAssign(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.confirmAndAutoAssign(id, user);
  }

  @Roles(...PERSONEL_VE_SUPERVIZOR)
  @Patch("incidents/:id/classification")
  updateClassification(@Param("id") id: string, @Body() dto: ClassificationDto, @CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.updateClassification(id, dto, user);
  }

  @Roles(...PERSONEL_VE_SUPERVIZOR)
  @Post("incidents/:id/messages")
  addMessage(@Param("id") id: string, @Body() dto: CreateMessageDto, @CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.addMessage(id, dto, user);
  }

  @Roles(...PERSONEL_VE_SUPERVIZOR)
  @Get("incidents/:id/messages")
  getMessages(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.getMessages(id, user);
  }

  @Roles(...PERSONEL_VE_SUPERVIZOR)
  @Patch("incidents/:id/messages/read")
  markMessagesRead(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.markMessagesRead(id, user);
  }

  @Roles(Role.SAHA_TEKNISYENI, Role.SUPERVIZOR)
  @Post("incidents/:id/resolution")
  createResolution(@Param("id") id: string, @Body() dto: CreateResolutionDto, @CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.createResolution(id, dto, user);
  }

  @Get("incidents/:id/resolution")
  getResolution(@Param("id") id: string, @CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.getResolution(id, user);
  }

  @Roles(Role.NOC_OPERATORU, Role.SUPERVIZOR)
  @Post("incidents/:id/resolution/rate")
  rateResolution(@Param("id") id: string, @Body() dto: RateResolutionDto, @CurrentUser() user: AccessTokenPayload) {
    return this.incidentsService.rateResolution(id, dto, user);
  }
}
