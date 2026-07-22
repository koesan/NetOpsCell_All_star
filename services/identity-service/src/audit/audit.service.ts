import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { AuditLog } from "../entities/audit-log.entity";

export interface AuditEntry {
  userId: string | null;
  actionType: string;
  ip: string | null;
  result: "SUCCESS" | "FAILURE";
  detail?: Record<string, unknown> | null;
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>) {}

  async log(entry: AuditEntry): Promise<void> {
    const row = this.auditRepo.create({
      userId: entry.userId,
      actionType: entry.actionType,
      ip: entry.ip,
      result: entry.result,
      detail: entry.detail ?? null,
    });
    await this.auditRepo.save(row);
  }

  async list(limit = 100): Promise<AuditLog[]> {
    return this.auditRepo.find({ order: { timestamp: "DESC" }, take: limit });
  }
}
