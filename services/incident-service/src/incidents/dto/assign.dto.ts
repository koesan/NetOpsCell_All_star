import { IsUUID } from "class-validator";

export class AssignDto {
  @IsUUID()
  teamId: string;
}
