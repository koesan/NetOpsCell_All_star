import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as crypto from "crypto";
import { TelegramLink } from "../entities/telegram-link.entity";
import { readSecret } from "../common/secrets";

/**
 * Gercek OTP teslimati — Telegram Bot API.
 *
 * Neden Telegram (SMS/WhatsApp Business API yerine)? Ucretsizdir, bir telefon numarasi
 * satin alinmasini veya Meta is hesabi onayini gerektirmez — @BotFather uzerinden 2
 * dakikada bir bot token'i alinip calisir hale getirilebilir (bkz. kok README "Telegram
 * OTP Kurulumu").
 *
 * Akis: musteri GSM'ini girer -> henuz Telegram baglamamissa bir tek-seferlik derin baglanti
 * (deep link, https://t.me/<bot>?start=<token>) doner -> musteri Telegram'da botu baslatir
 * -> bu servis (long-polling ile, WEBHOOK/genel-erisilebilir-URL GEREKTIRMEDEN) /start
 * mesajini yakalar, GSM<->chatId eslemesini kaydeder -> bundan sonraki tum OTP kodlari o
 * sohbete GERCEKTEN gonderilir (kod ASLA API yanitinda veya UI'da donmez).
 *
 * Bagimsizlik: bot token tanimli degilse polling baslamaz, isConfigured() false doner;
 * cagiran taraf (auth.service.ts) bu durumda eski simulasyon fallback'ine duser (yalnizca
 * yerel gelistirme/test icin — bkz. auth.service.ts register()).
 */
@Injectable()
export class TelegramService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramService.name);
  private readonly botToken: string;
  private readonly botUsername: string;
  private offset = 0;
  private polling = false;
  private stopped = false;

  constructor(@InjectRepository(TelegramLink) private readonly linkRepo: Repository<TelegramLink>) {
    this.botToken = readSecret("TELEGRAM_BOT_TOKEN", "");
    this.botUsername = process.env.TELEGRAM_BOT_USERNAME || "";
  }

  isConfigured(): boolean {
    return Boolean(this.botToken && this.botUsername);
  }

  private apiUrl(method: string): string {
    return `https://api.telegram.org/bot${this.botToken}/${method}`;
  }

  onModuleInit(): void {
    if (!this.isConfigured()) {
      this.logger.warn(
        "TELEGRAM_BOT_TOKEN/TELEGRAM_BOT_USERNAME tanimli degil — gercek OTP teslimati devre disi, " +
          "yerel gelistirme icin simulasyon fallback'i kullanilacak (bkz. README 'Telegram OTP Kurulumu')."
      );
      return;
    }
    this.polling = true;
    void this.pollLoop();
  }

  onModuleDestroy(): void {
    this.stopped = true;
  }

  /** GSM icin var olan baglanti kaydini dondurur, yoksa yeni bir linkToken uretir. */
  async getOrCreateLink(gsm: string): Promise<TelegramLink> {
    let link = await this.linkRepo.findOne({ where: { gsm } });
    if (!link) {
      link = this.linkRepo.create({ gsm, linkToken: crypto.randomBytes(12).toString("hex"), chatId: null, linkedAt: null });
      await this.linkRepo.save(link);
    }
    return link;
  }

  buildDeepLink(linkToken: string): string {
    return `https://t.me/${this.botUsername}?start=${linkToken}`;
  }

  async isLinked(gsm: string): Promise<boolean> {
    const link = await this.linkRepo.findOne({ where: { gsm } });
    return Boolean(link?.chatId);
  }

  /** OTP kodunu gercekten Telegram mesaji olarak gonderir. Basarisizlikta false doner —
   * cagiran taraf (auth.service.ts) bunu kullaniciya "tekrar deneyin" olarak yansitir. */
  async sendOtp(chatId: string, code: string): Promise<boolean> {
    try {
      const response = await fetch(this.apiUrl("sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🔐 NetOpsCell dogrulama kodunuz: ${code}\n\nBu kod 5 dakika gecerlidir. Kodu kimseyle paylasmayin.`,
        }),
      });
      return response.ok;
    } catch (err) {
      this.logger.error(`Telegram sendOtp basarisiz: ${(err as Error).message}`);
      return false;
    }
  }

  /** Webhook/genel-erisilebilir-URL gerektirmeyen long-polling dongusu — Docker Compose
   * gibi yerel/kapali aglarda calismak icin bilincli tercih (yalnizca disariya HTTPS
   * cikisi yeterli). */
  private async pollLoop(): Promise<void> {
    this.logger.log("Telegram long-polling baslatildi.");
    while (!this.stopped) {
      try {
        const response = await fetch(this.apiUrl("getUpdates") + `?offset=${this.offset + 1}&timeout=25`, {
          signal: AbortSignal.timeout(30_000),
        });
        const body = (await response.json()) as { ok: boolean; result: TelegramUpdate[] };
        if (!body.ok) continue;

        for (const update of body.result) {
          this.offset = update.update_id;
          await this.handleUpdate(update);
        }
      } catch (err) {
        if (!this.stopped) {
          this.logger.warn(`Telegram polling hatasi (5sn sonra tekrar denenecek): ${(err as Error).message}`);
          await new Promise((r) => setTimeout(r, 5000));
        }
      }
    }
  }

  private async handleUpdate(update: TelegramUpdate): Promise<void> {
    const text = update.message?.text?.trim();
    const chatId = update.message?.chat?.id;
    if (!text || chatId === undefined) return;

    if (text.startsWith("/start")) {
      const token = text.split(/\s+/)[1];
      if (!token) {
        await this.notify(chatId, "Merhaba! Lütfen NetOpsCell uygulamasındaki bağlantı düğmesini kullanarak buraya gelin.");
        return;
      }
      const link = await this.linkRepo.findOne({ where: { linkToken: token } });
      if (!link) {
        await this.notify(chatId, "Geçersiz veya süresi dolmuş bağlantı kodu. Lütfen uygulamadan yeni bir kod alın.");
        return;
      }
      link.chatId = String(chatId);
      link.linkedAt = new Date();
      await this.linkRepo.save(link);
      await this.notify(
        chatId,
        "✅ Telefon numaranız NetOpsCell hesabınıza bağlandı. Uygulamaya dönüp doğrulama kodunuzu isteyebilirsiniz."
      );
      this.logger.log(`Telegram baglantisi tamamlandi: gsm=${link.gsm}`);
    }
  }

  private async notify(chatId: number, text: string): Promise<void> {
    try {
      await fetch(this.apiUrl("sendMessage"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text }),
      });
    } catch {
      // bilgilendirme mesaji basarisiz olsa da baglanti kaydi zaten yapildi, akis etkilenmez
    }
  }
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    text?: string;
    chat: { id: number };
  };
}
