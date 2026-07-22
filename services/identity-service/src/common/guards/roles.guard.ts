import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Role } from "../enums/role.enum";
import { AuditService } from "../../audit/audit.service";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !requiredRoles.includes(user.role)) {
      await this.auditService.log({
        userId: user?.sub ?? null,
        actionType: "YETKISIZ_ERISIM_DENEMESI",
        ip: request.ip,
        result: "FAILURE",
        detail: { path: request.originalUrl, method: request.method, requiredRoles, actualRole: user?.role },
      });
      throw new ForbiddenException("Bu islem icin yetkiniz yok.");
    }
    return true;
  }
}
