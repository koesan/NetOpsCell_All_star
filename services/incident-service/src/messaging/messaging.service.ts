import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { MongoService } from "./mongo.service";
import { MessageDocument } from "./message.schema";

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_MESSAGES = 20; // kullanici basina, vaka basina, dakikada

/**
 * Faz 3 - Saha mesajlasma is mantigi. Icerik MongoDB'de tutulur (bkz. mongo.service.ts).
 * Anti-spam: kullanici+vaka basina kayan pencere (sliding window) rate limit - tek
 * instance icin bellek ici sayaç yeterlidir; yatay olcekleme durumunda bu sayaç
 * Redis'e tasinmalidir (bkz. ARCHITECTURE.md Bolum 20 - Olceklenebilirlik notu).
 */
@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private readonly sendTimestamps = new Map<string, number[]>();

  constructor(private readonly mongoService: MongoService) {}

  private assertNotSpamming(userId: string, incidentId: string): void {
    const key = `${userId}:${incidentId}`;
    const now = Date.now();
    const recent = (this.sendTimestamps.get(key) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);

    if (recent.length >= RATE_LIMIT_MAX_MESSAGES) {
      throw new HttpException("Bu vaka icin dakikada en fazla 20 mesaj gonderebilirsiniz.", HttpStatus.TOO_MANY_REQUESTS);
    }
    recent.push(now);
    this.sendTimestamps.set(key, recent);
  }

  async sendMessage(incidentId: string, senderId: string, senderRole: string, content: string): Promise<MessageDocument> {
    this.assertNotSpamming(senderId, incidentId);

    const message: MessageDocument = {
      incidentId,
      senderId,
      senderRole,
      content,
      messageType: "TEXT",
      status: "SENT",
      readBy: [],
      createdAt: new Date(),
    };

    const result = await this.mongoService.messagesCollection().insertOne(message);
    return { ...message, _id: result.insertedId };
  }

  async getThread(incidentId: string): Promise<MessageDocument[]> {
    return this.mongoService
      .messagesCollection()
      .find({ incidentId })
      .sort({ createdAt: 1 })
      .limit(500)
      .toArray();
  }

  /** Okuma bilgisi (read receipt): cagiran kullanici icin thread'deki henuz okunmamis
   * tum mesajlari "READ" olarak isaretler - gercek bir kurumsal mesajlasma sisteminde
   * (WhatsApp/Slack tarzi) beklenen bir ozellik. */
  async markThreadRead(incidentId: string, userId: string): Promise<number> {
    const result = await this.mongoService.messagesCollection().updateMany(
      {
        incidentId,
        senderId: { $ne: userId },
        "readBy.userId": { $ne: userId },
      },
      {
        $set: { status: "READ" },
        $push: { readBy: { userId, readAt: new Date() } },
      }
    );
    return result.modifiedCount;
  }
}
