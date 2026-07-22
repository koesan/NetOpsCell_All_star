import { GamificationService } from "./gamification.service";
import { BadgeCode } from "../common/enums/enums";

// Faz 1: RabbitMQ henuz baglanmadigi icin bu servis "ic fonksiyon" olarak test edilir
// (bkz. ARCHITECTURE.md Bolum 15, Faz 1 - Gamification). TypeORM repo'lari ve Redis
// hafif sahte (fake) nesnelerle degistirilir; gercek DB/Redis gerekmez.

class FakeStatsRepo {
  private store = new Map<string, any>();

  async findOne({ where: { userId } }: any) {
    return this.store.get(userId) ?? null;
  }

  create(partial: any) {
    return {
      userId: partial.userId,
      totalPoints: 0,
      resolvedCount: 0,
      fastResponseCount: 0,
      noRepeatStreak: 0,
      criticalWithinSlaCount: 0,
      dailyResolvedDate: null,
      dailyResolvedCount: 0,
      resolvedByType: {},
      ...partial,
    };
  }

  async save(entity: any) {
    this.store.set(entity.userId, entity);
    return entity;
  }

  async increment({ userId }: any, field: string, amount: number) {
    const entity = this.store.get(userId);
    entity[field] += amount;
  }

  async update({ userId }: any, patch: any) {
    const entity = this.store.get(userId);
    Object.assign(entity, patch);
  }
}

class FakeLedgerRepo {
  entries: any[] = [];
  async insert(entry: any) {
    this.entries.push(entry);
  }
}

class FakeBadgeRepo {
  private store: any[] = [];
  async find({ where: { userId } }: any) {
    return this.store.filter((b) => b.userId === userId);
  }
  async insert(entry: any) {
    this.store.push(entry);
  }
}

class FakeRedisService {
  addPoints = jest.fn().mockResolvedValue(undefined);
  getLeaderboard = jest.fn().mockResolvedValue([]);
}

class FakeEventPublisherService {
  publish = jest.fn().mockResolvedValue(undefined);
}

describe("GamificationService", () => {
  let service: GamificationService;
  let statsRepo: FakeStatsRepo;
  let ledgerRepo: FakeLedgerRepo;
  let badgeRepo: FakeBadgeRepo;

  beforeEach(() => {
    statsRepo = new FakeStatsRepo();
    ledgerRepo = new FakeLedgerRepo();
    badgeRepo = new FakeBadgeRepo();
    service = new GamificationService(
      ledgerRepo as any,
      badgeRepo as any,
      statsRepo as any,
      new FakeRedisService() as any,
      new FakeEventPublisherService() as any
    );
  });

  it("cozulen ariza icin +10 puan verir ve ILK_MUDAHALE rozetini kazandirir", async () => {
    const result = await service.handleIncidentResolved({
      incident_id: "INC-2026-000001",
      team_id: "team-1",
      fault_type: "ISINMA",
      priority: "ORTA",
      created_at: new Date().toISOString(),
      resolved_at: new Date().toISOString(),
      within_half_sla: false,
      within_sla: true,
    });

    const profile = await service.getProfile("team-1");
    expect(profile.totalPoints).toBe(10);
    expect(profile.resolvedCount).toBe(1);
    expect(result.newBadges).toContain(BadgeCode.ILK_MUDAHALE);
  });

  it("SLA'nin yarisindan once cozulunce +5 hizli mudahale bonusu ekler", async () => {
    await service.handleIncidentResolved({
      incident_id: "INC-2026-000002",
      team_id: "team-2",
      fault_type: "BAGLANTI",
      priority: "ORTA",
      created_at: new Date().toISOString(),
      resolved_at: new Date().toISOString(),
      within_half_sla: true,
      within_sla: true,
    });

    const profile = await service.getProfile("team-2");
    expect(profile.totalPoints).toBe(15); // 10 + 5
  });

  it("KRITIK ariza SLA icinde cozulunce +15 bonus ekler", async () => {
    await service.handleIncidentResolved({
      incident_id: "INC-2026-000003",
      team_id: "team-3",
      fault_type: "GUC_KESINTISI",
      priority: "KRITIK",
      created_at: new Date().toISOString(),
      resolved_at: new Date().toISOString(),
      within_half_sla: false,
      within_sla: true,
    });

    const profile = await service.getProfile("team-3");
    expect(profile.totalPoints).toBe(25); // 10 + 15
  });

  it("SLA asiminda -5 puan uygular", async () => {
    await service.handleSlaExceeded({ incident_id: "INC-2026-000004", team_id: "team-4", priority: "YUKSEK" });
    const profile = await service.getProfile("team-4");
    expect(profile.totalPoints).toBe(-5);
  });

  it("tekrar eden arizada -3 puan uygular ve noRepeatStreak'i sifirlar", async () => {
    await service.handleIncidentResolved({
      incident_id: "INC-2026-000005",
      team_id: "team-5",
      fault_type: "YAZILIM",
      priority: "DUSUK",
      created_at: new Date().toISOString(),
      resolved_at: new Date().toISOString(),
      within_half_sla: false,
      within_sla: true,
    });

    await service.handleIncidentRepeated({
      incident_id: "INC-2026-000006",
      prior_incident_id: "INC-2026-000005",
      team_id: "team-5",
      station_code: "BTS-001",
    });

    const profile = await service.getProfile("team-5");
    expect(profile.totalPoints).toBe(7); // 10 - 3
  });

  it("kalici cozum degerlendirmesinde +10 bonus ekler", async () => {
    await service.handleResolutionRated({
      incident_id: "INC-2026-000007",
      team_id: "team-6",
      rating: 5,
      is_permanent: true,
      rated_by: "noc-1",
      rated_at: new Date().toISOString(),
    });

    const profile = await service.getProfile("team-6");
    expect(profile.totalPoints).toBe(10);
  });
});
