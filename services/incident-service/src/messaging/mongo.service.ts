import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Collection, Db, MongoClient } from "mongodb";
import { readSecret } from "../common/secrets";
import { MessageDocument } from "./message.schema";

/**
 * Faz 3 - Saha mesajlasma sistemi icin MongoDB baglantisi. Incident Service kendi
 * veritabani sinirlari icinde (database-per-service ihlal edilmez) ikinci bir veri
 * deposu kullanir: iliskisel veri (vaka/SLA/durum) PostgreSQL'de, yuksek hacimli,
 * ekleme-agirlikli, dokuman-yapili mesaj verisi MongoDB'de tutulur.
 * Bkz. docs/ARCHITECTURE.md Bolum 20 (Mesajlasma Mimarisi).
 */
@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoService.name);
  private client!: MongoClient;
  private db!: Db;

  async onModuleInit(): Promise<void> {
    const host = process.env.MONGO_HOST || "localhost";
    const port = process.env.MONGO_PORT || "27017";
    const user = process.env.MONGO_USER || "incident_service";
    const password = readSecret("MONGO_PASSWORD", "changeme");
    const dbName = process.env.MONGO_DB || "incident_messages";

    // serverSelectionTimeoutMS, Gateway'in proxyTimeout degerinden (5000ms) belirgin sekilde
    // dusuk tutulur; aksi halde Mongo erisilemez oldugunda Gateway baglantiyi Mongo suruculeri
    // kendi hatasini uretmeden once keser ve istemciye bos/tutarsiz bir yanit doner (bkz.
    // ARCHITECTURE.md Bolum 20 - Zaman Asimi Butcesi).
    const url = `mongodb://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${dbName}?authSource=admin`;
    this.client = new MongoClient(url, { serverSelectionTimeoutMS: 2500 });
    await this.client.connect();
    this.db = this.client.db(dbName);

    await this.messagesCollection().createIndex({ incidentId: 1, createdAt: 1 });
    this.logger.log("MongoDB baglantisi kuruldu (saha mesajlasma)");
  }

  async onModuleDestroy(): Promise<void> {
    await this.client?.close();
  }

  messagesCollection(): Collection<MessageDocument> {
    return this.db.collection<MessageDocument>("messages");
  }
}
