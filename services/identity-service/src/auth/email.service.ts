import { Injectable, Logger } from "@nestjs/common";
import * as nodemailer from "nodemailer";
import { readSecret } from "../common/secrets";

/**
 * OTP kodunun gercek teslimat kanallarindan biri: e-posta (SMTP). Musteri kayit
 * sirasinda e-posta girdiyse VE SMTP yapilandirilmissa, kod dogrudan o adrese
 * gonderilir ve API yanitinda donmez. SMTP yapilandirilmamissa veya musteri
 * e-posta girmediyse bu kanal devre disi kalir — cagiran taraf (auth.service.ts)
 * bu durumda kodu yanitta gostermeye duser (bkz. register()).
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: nodemailer.Transporter | null;
  private readonly fromAddress: string;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = parseInt(process.env.SMTP_PORT || "587", 10);
    const user = process.env.SMTP_USER;
    const password = readSecret("SMTP_PASSWORD", "");
    this.fromAddress = process.env.SMTP_FROM || user || "netopscell@example.com";

    if (host && user && password) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass: password },
      });
    } else {
      this.transporter = null;
      this.logger.warn(
        "SMTP yapilandirilmamis (SMTP_HOST/SMTP_USER/SMTP_PASSWORD) — e-posta ile OTP teslimati devre disi."
      );
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  /** OTP kodunu e-postayla gonderir. Basarisizlikta false doner — cagiran taraf
   * kodu web'de gostermeye duser, akis asla bloke olmaz. */
  async sendOtp(toEmail: string, code: string): Promise<boolean> {
    if (!this.transporter) return false;
    try {
      await this.transporter.sendMail({
        from: this.fromAddress,
        to: toEmail,
        subject: "NetOpsCell Doğrulama Kodunuz",
        text: `Doğrulama kodunuz: ${code}\n\nBu kod 5 dakika geçerlidir. Kodu kimseyle paylaşmayın.`,
        html: `<p>Doğrulama kodunuz: <strong style="font-size:20px">${code}</strong></p><p>Bu kod 5 dakika geçerlidir. Kodu kimseyle paylaşmayın.</p>`,
      });
      return true;
    } catch (err) {
      this.logger.warn(`E-posta gonderimi basarisiz (koda web'de dusulecek): ${(err as Error).message}`);
      return false;
    }
  }
}
