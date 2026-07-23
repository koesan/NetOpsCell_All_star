import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Not, Repository } from "typeorm";
import * as bcrypt from "bcryptjs";
import { User } from "../entities/user.entity";
import { CreatePersonnelDto } from "./dto/create-personnel.dto";
import { UpdateRoleDto } from "./dto/update-role.dto";
import { UpdatePersonnelDto } from "./dto/update-personnel.dto";
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
      throw new ConflictException("Bu e-posta ile kayıtlı bir hesap zaten var.");
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
      detail: { newUserId: user.id, role: user.role, email: user.email },
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
      throw new NotFoundException("Kullanıcı bulunamadı.");
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

  async updatePersonnel(userId: string, dto: UpdatePersonnelDto, changedBy: string): Promise<Partial<User>> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Kullanıcı bulunamadı.");
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepo.findOne({ where: { email: dto.email, id: Not(userId) } });
      if (existing) {
        throw new ConflictException("Bu e-posta başka bir kullanıcı tarafından kullanılıyor.");
      }
      user.email = dto.email;
    }

    if (dto.name !== undefined) user.name = dto.name;
    if (dto.surname !== undefined) user.surname = dto.surname;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.expertise !== undefined) user.expertise = dto.expertise;
    if (dto.region !== undefined) user.region = dto.region;
    if (dto.status !== undefined) user.status = dto.status;
    if (dto.latitude !== undefined) user.latitude = dto.latitude;
    if (dto.longitude !== undefined) user.longitude = dto.longitude;

    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);
    }

    await this.userRepo.save(user);

    await this.auditService.log({
      userId: changedBy,
      actionType: "PERSONEL_GUNCELLENDI",
      ip: null,
      result: "SUCCESS",
      detail: { targetUserId: user.id, role: user.role, status: user.status },
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

  async deletePersonnel(userId: string, deletedBy: string): Promise<{ deleted: boolean; id: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("Kullanıcı bulunamadı.");
    }

    user.status = UserStatus.INACTIVE;
    await this.userRepo.save(user);

    await this.auditService.log({
      userId: deletedBy,
      actionType: "PERSONEL_PASIFE_ALINDI",
      ip: null,
      result: "SUCCESS",
      detail: { targetUserId: user.id, email: user.email },
    });

    return { deleted: true, id: userId };
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
