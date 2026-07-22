import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Station } from "../entities/station.entity";

/** Istanbul genelinde gercek ilce merkezlerine yerlestirilmis demo istasyon envanteri.
 * Koordinatlar gercek cografyayla uyumludur ki harita uzerindeki mesafe/rota ve
 * AI atama skorundaki mesafe_yakinlik bileseni anlamli olsun. */
const SEED_STATIONS: Omit<Station, "id" | "createdAt">[] = [
  { code: "BTS-IST-001", name: "Levent Plaza", district: "Besiktas", region: "Avrupa", latitude: 41.0819, longitude: 29.0111, technology: "5G", coverageUsers: 42000 },
  { code: "BTS-IST-002", name: "Maslak Buyukdere", district: "Sariyer", region: "Avrupa", latitude: 41.1121, longitude: 29.0208, technology: "5G", coverageUsers: 38000 },
  { code: "BTS-IST-003", name: "Taksim Meydan", district: "Beyoglu", region: "Avrupa", latitude: 41.0370, longitude: 28.9850, technology: "4G/5G", coverageUsers: 55000 },
  { code: "BTS-IST-004", name: "Mecidiyekoy Metrobus", district: "Sisli", region: "Avrupa", latitude: 41.0637, longitude: 28.9906, technology: "4G/5G", coverageUsers: 47000 },
  { code: "BTS-IST-005", name: "Bakirkoy Sahil", district: "Bakirkoy", region: "Avrupa", latitude: 40.9744, longitude: 28.8719, technology: "4G", coverageUsers: 29000 },
  { code: "BTS-IST-006", name: "Atakoy Marina", district: "Bakirkoy", region: "Avrupa", latitude: 40.9723, longitude: 28.8443, technology: "5G", coverageUsers: 18000 },
  { code: "BTS-IST-007", name: "Fatih Aksaray", district: "Fatih", region: "Avrupa", latitude: 41.0055, longitude: 28.9494, technology: "4G", coverageUsers: 33000 },
  { code: "BTS-IST-008", name: "Eminonu Sirkeci", district: "Fatih", region: "Avrupa", latitude: 41.0172, longitude: 28.9770, technology: "4G/5G", coverageUsers: 40000 },
  { code: "BTS-IST-009", name: "Basaksehir Metrokent", district: "Basaksehir", region: "Avrupa", latitude: 41.0931, longitude: 28.8020, technology: "5G", coverageUsers: 26000 },
  { code: "BTS-IST-010", name: "Kadikoy Iskele", district: "Kadikoy", region: "Anadolu", latitude: 40.9928, longitude: 29.0253, technology: "4G/5G", coverageUsers: 51000 },
  { code: "BTS-IST-011", name: "Moda Sahil", district: "Kadikoy", region: "Anadolu", latitude: 40.9819, longitude: 29.0246, technology: "4G", coverageUsers: 17000 },
  { code: "BTS-IST-012", name: "Uskudar Meydan", district: "Uskudar", region: "Anadolu", latitude: 41.0255, longitude: 29.0158, technology: "4G/5G", coverageUsers: 36000 },
  { code: "BTS-IST-013", name: "Umraniye Carsi", district: "Umraniye", region: "Anadolu", latitude: 41.0164, longitude: 29.1248, technology: "4G", coverageUsers: 31000 },
  { code: "BTS-IST-014", name: "Atasehir Finans Merkezi", district: "Atasehir", region: "Anadolu", latitude: 40.9923, longitude: 29.1274, technology: "5G", coverageUsers: 44000 },
  { code: "BTS-IST-015", name: "Maltepe Sahil", district: "Maltepe", region: "Anadolu", latitude: 40.9351, longitude: 29.1310, technology: "4G", coverageUsers: 22000 },
  { code: "BTS-IST-016", name: "Kartal Adliye", district: "Kartal", region: "Anadolu", latitude: 40.8898, longitude: 29.1872, technology: "4G/5G", coverageUsers: 27000 },
  { code: "BTS-IST-017", name: "Pendik Marina", district: "Pendik", region: "Anadolu", latitude: 40.8747, longitude: 29.2350, technology: "4G", coverageUsers: 19000 },
  { code: "BTS-IST-018", name: "Beylikduzu Marmara Park", district: "Beylikduzu", region: "Avrupa", latitude: 41.0022, longitude: 28.6440, technology: "5G", coverageUsers: 24000 },
];

@Injectable()
export class StationsService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StationsService.name);

  constructor(@InjectRepository(Station) private readonly stationRepo: Repository<Station>) {}

  /** Ilk acilista katalog bossa demo envanteri yukler (idempotent). */
  async onApplicationBootstrap(): Promise<void> {
    const count = await this.stationRepo.count();
    if (count > 0) return;
    await this.stationRepo.save(SEED_STATIONS.map((s) => this.stationRepo.create(s)));
    this.logger.log(`Baz istasyonu katalogu yuklendi: ${SEED_STATIONS.length} istasyon`);
  }

  findAll(): Promise<Station[]> {
    return this.stationRepo.find({ order: { code: "ASC" } });
  }

  findByCode(code: string): Promise<Station | null> {
    return this.stationRepo.findOne({ where: { code } });
  }
}
