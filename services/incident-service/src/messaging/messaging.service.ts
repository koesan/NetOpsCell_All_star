import { HttpException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { MongoService } from "./mongo.service";
import { ChatComplaintAnalysis, MessageDocument } from "./message.schema";

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

  async sendMessage(
    incidentId: string,
    senderId: string,
    senderRole: string,
    content: string,
    senderName?: string
  ): Promise<MessageDocument> {
    this.assertNotSpamming(senderId, incidentId);

    const message: MessageDocument = {
      incidentId,
      senderId,
      senderRole,
      senderName,
      content,
      messageType: "TEXT",
      status: "SENT",
      readBy: [],
      createdAt: new Date(),
    };

    const result = await this.mongoService.messagesCollection().insertOne(message);
    return { ...message, _id: result.insertedId };
  }

  /** Vaka yasam dongusu olaylarini (atama, yola cikis, varis, cozum...) thread'e
   * otomatik dusuren sistem mesaji. WhatsApp'taki "grup olaylari" gibi ortada gosterilir.
   * Mongo erisilemezse sessizce atlanir — sistem mesaji hicbir is akisini bloke edemez. */
  async sendSystemMessage(incidentId: string, content: string): Promise<void> {
    try {
      await this.mongoService.messagesCollection().insertOne({
        incidentId,
        senderId: "system",
        senderRole: "SYSTEM",
        senderName: "Sistem",
        content,
        messageType: "SYSTEM",
        status: "SENT",
        readBy: [],
        createdAt: new Date(),
      });
    } catch (err) {
      this.logger.warn(`Sistem mesaji yazilamadi (akis etkilenmez): ${(err as Error).message}`);
    }
  }

  /** Musterinin sikayet metnini ve Gemini on analizini vaka acilir acilmaz thread'e
   * bir "konusma" gibi duser: once musterinin yazdigi orijinal metin (TEXT), hemen
   * ardindan AI'in yapilandirilmis yanit balonu (AI_ANALYSIS) — boylece NOC/teknisyen
   * hicbir ekstra tiklama yapmadan "buyuk ihtimalle X alaninda sorun var" tarzi analizi
   * mesaj akisinda gorur. Mongo erisilemezse sessizce atlanir (akis bloke olmaz). */
  async seedComplaintThread(
    incidentId: string,
    customerId: string,
    customerNote: string,
    analysis: ChatComplaintAnalysis
  ): Promise<void> {
    try {
      await this.mongoService.messagesCollection().insertMany([
        {
          incidentId,
          senderId: customerId,
          senderRole: "MUSTERI",
          senderName: "Müşteri",
          content: customerNote,
          messageType: "TEXT",
          status: "SENT",
          readBy: [],
          createdAt: new Date(),
        },
        {
          incidentId,
          senderId: "ai-service",
          senderRole: "AI",
          senderName: "AI Ön Analiz",
          content: analysis.olasi_neden,
          messageType: "AI_ANALYSIS",
          status: "SENT",
          readBy: [],
          createdAt: new Date(Date.now() + 500),
          analysis,
        },
      ]);
    } catch (err) {
      this.logger.warn(`Sikayet/AI analiz mesaji yazilamadi (akis etkilenmez): ${(err as Error).message}`);
    }
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
