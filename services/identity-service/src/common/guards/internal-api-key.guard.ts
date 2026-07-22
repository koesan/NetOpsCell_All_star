import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { timingSafeEqual } from "crypto";
import { readSecret } from "../secrets";

// Servisler arasi (east-west) dahili endpoint'ler icin hafif koruma.
// Gateway uzerinden yonlendirilmez; sadece docker network icinden cagrilir.
@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided: string | undefined = request.headers["x-internal-key"];
    const expected = readSecret("INTERNAL_API_KEY", "");

    if (!provided || !expected || !safeCompare(provided, expected)) {
      throw new UnauthorizedException("Dahili erisim anahtari gecersiz.");
    }
    return true;
  }
}

// Sabit-zamanli karsilastirma: string uzunluklari/icerikleri farkli hizlarda karsilastirilirsa
// olusan zamanlama farki, anahtari karakter karakter tahmin etmeye calisan bir saldirgana
// bilgi sizdirabilir (timing attack). Bu yuzden basit `===` yerine timingSafeEqual kullanilir.
function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
