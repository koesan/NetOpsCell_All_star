import { IsEnum, IsOptional, IsString } from "class-validator";
import { IncidentStatus } from "../../common/enums/enums";

export class UpdateStatusDto {
  @IsEnum(IncidentStatus)
  status: IncidentStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}
