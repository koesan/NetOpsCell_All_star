import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { Role } from "../enums/enums";
import { EventPublisherService } from "../events/event-publisher.service";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly eventPublisher: EventPublisherService
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
      await this.eventPublisher.publish("audit.log", {
        user_id: user?.sub ?? null,
        action_type: "YETKISIZ_ERISIM_DENEMESI",
        timestamp: new Date().toISOString(),
        ip: request.ip,
        result: "FAILURE",
        detail: { path: request.originalUrl, method: request.method, requiredRoles, actualRole: user?.role },
      });
      throw new ForbiddenException("Bu islem icin yetkiniz yok.");
    }
    return true;
  }
}
