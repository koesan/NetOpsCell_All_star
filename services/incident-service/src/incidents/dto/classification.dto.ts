import { IsEnum, IsOptional } from "class-validator";
import { FaultType, Priority } from "../../common/enums/enums";

export class ClassificationDto {
  @IsOptional()
  @IsEnum(FaultType)
  faultType?: FaultType;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}
