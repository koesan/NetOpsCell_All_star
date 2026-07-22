import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import { User } from "../entities/user.entity";
import { CreatePersonnelDto } from "./dto/create-personnel.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { AuditService } from "../audit/audit.service";
import { EventPublisherService } from "../common/events/event-publisher.service";
import { UserStatus } from "../common/enums/user-status.enum";
import { Role } from "../common/enums/role.enum";

const PASSWORD_HASH_ROUNDS = 10;

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly auditService: AuditService,
    private readonly eventPublisher: EventPublisherService
  ) {}

  async createPersonnel(dto: CreatePersonnelDto, createdBy: string): Promise<Partial<User>> {
    const existing = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException("Bu e-posta ile kayitli bir hesap zaten var.");
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);
    const user = this.userRepo.create({
      role: dto.role,
      email: dto.email,
      name: dto.name,
      surname: dto.surname,
      passwordHash,
      expertise: dto.expertise ?? null,
      region: dto.region ?? null,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      status: UserStatus.ACTIVE,
    });
    await this.userRepo.save(user);

    await this.auditService.log({
      userId: createdBy,
      actionType: "PERSONEL_HESABI_OLUSTURULDU",
      ip: null,
      result: "SUCCESS",
      detail: { newUserId: user.id, role: user.role },
    });

    await this.eventPublisher.publish("team.profile.updated", {
      team_id: user.id,
      expertise: user.expertise,
      region: user.region,
      lat: user.latitude,
      lng: user.longitude,
      updated_at: new Date().toISOString(),
    });

    const { passwordHash: _hash, ...safe } = user;
    return safe;
  }

  async updateRole(userId: string, dto: UpdateRoleDto, changedBy: string): Promise<Partial<User>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new ConflictException("Kullanici bulunamadi.");
    }
    const previousRole = user.role;
    user.role = dto.role;
    await this.userRepo.save(user);

    await this.auditService.log({
      userId: changedBy,
      actionType: "ROL_DEGISIKLIGI",
      ip: null,
      result: "SUCCESS",
      detail: { targetUserId: user.id, previousRole, newRole: user.role },
    });

    const { passwordHash: _hash, ...safe } = user;
    return safe;
  }

  async listAuditLogs(limit: number) {
    return this.auditService.list(limit);
  }

  async listPersonnel(): Promise<Partial<User>[]> {
    const users = await this.userRepo.find({
      where: { role: Not(Role.MUSTERI) },
      order: { createdAt: "DESC" },
    });
    return users.map(({ passwordHash: _hash, ...safe }) => safe);
  }
}
