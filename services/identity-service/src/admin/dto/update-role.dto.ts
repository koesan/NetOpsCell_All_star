import { IsEnum } from "class-validator";
import { Role } from "../../common/enums/role.enum";

export class UpdateRoleDto {
  @IsEnum(Role, { message: "Gecerli bir rol seciniz." })
  role: Role;
}
