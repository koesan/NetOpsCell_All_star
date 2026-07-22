import { HttpService } from "@nestjs/axios";
import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import CircuitBreaker from "opossum";

export interface PredictResult {
  probability: number;
  fault_type: string | null;
  recommendation: "IZLE" | "VAKA_AC" | "ACIL";
  priority_hint: "DUSUK" | "ORTA" | "YUKSEK" | "KRITIK";
  model_version: string;
}

export interface AssignResult {
  assigned_team: {
    team_id: string;
    name: string | null;
    score: number;
    uzmanlik_eslesme: number;
    mesafe_yakinlik: number;
    bosluk_orani: number;
    distance_km: number | null;
  } | null;
  queued: boolean;
  candidates_evaluated: number;
}

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://ai-service:8000";
const TIMEOUT_MS = parseInt(process.env.AI_SERVICE_TIMEOUT_MS || "2000", 10);

/**
 * Faz 3 - Circuit Breaker (opossum). Sadece timeout+catch yerine gercek devre kesici deseni:
 * AI Service ardisik olarak basarisiz olmaya baslarsa (esik: %50 hata orani, 10 istek pencere),
 * devre "acik" konuma gecer ve sonraki cagrilar AGA HIC CIKMADAN aninda fallback'e duser
 * (2sn timeout'u tekrar tekrar beklemek yerine). Bir sure sonra (resetTimeout) devre
 * "yari-acik" olur ve tek bir deneme yaparak AI'in geri gelip gelmedigini kontrol eder.
 * Bu, hem gecikmeyi azaltir hem de zaten struggling olan bir servisi istekle bogmayi engeller.
 * Bkz. docs/ARCHITECTURE.md Bolum 11 (Dayaniklilik).
 */
const BREAKER_OPTIONS: CircuitBreaker.Options = {
  timeout: TIMEOUT_MS,
  errorThresholdPercentage: 50,
  resetTimeout: 10000,
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  volumeThreshold: 3, // en az 3 istek olmadan yuzde hesaplanmaz (soguk baslangicta yanlis acilmayi onler)
};

@Injectable()
export class AiClientService implements OnModuleInit {
  private readonly logger = new Logger(AiClientService.name);
  private predictBreaker!: CircuitBreaker<[Record<string, unknown>], PredictResult | null>;
  private assignBreaker!: CircuitBreaker<[Record<string, unknown>], AssignResult | null>;

  constructor(private readonly httpService: HttpService) {}

  onModuleInit(): void {
    this.predictBreaker = new CircuitBreaker(this.rawPredict.bind(this), { ...BREAKER_OPTIONS, name: "ai-predict" });
    this.assignBreaker = new CircuitBreaker(this.rawAssign.bind(this), { ...BREAKER_OPTIONS, name: "ai-assign" });

    for (const [label, breaker] of [
      ["predict", this.predictBreaker],
      ["assign", this.assignBreaker],
    ] as const) {
      breaker.on("open", () => this.logger.warn(`Circuit breaker ACIK (${label}): AI Service istekleri artik hemen fallback'e duser`));
      breaker.on("halfOpen", () => this.logger.log(`Circuit breaker YARI-ACIK (${label}): AI Service tekrar deneniyor`));
      breaker.on("close", () => this.logger.log(`Circuit breaker KAPALI (${label}): AI Service normale dondu`));
    }
  }

  private async rawPredict(payload: Record<string, unknown>): Promise<PredictResult | null> {
    const response = await firstValueFrom(
      this.httpService.post<{ success: boolean; data: PredictResult }>(`${AI_SERVICE_URL}/api/v1/ai/predict`, payload, {
        timeout: TIMEOUT_MS,
      })
    );
    return response.data.data;
  }

  private async rawAssign(payload: Record<string, unknown>): Promise<AssignResult | null> {
    const response = await firstValueFrom(
      this.httpService.post<{ success: boolean; data: AssignResult }>(`${AI_SERVICE_URL}/api/v1/ai/assign`, payload, {
        timeout: TIMEOUT_MS,
      })
    );
    return response.data.data;
  }

  /** AI Service erisilemezse (veya devre aciksa) null doner; cagiran kod BELIRSIZ/ORTA
   * fallback'ine duser (bkz. ARCHITECTURE.md Bolum 4.3 - bagimsizlik ilkesi). */
  async predict(payload: {
    station_code: string;
    signal_strength: number;
    packet_loss: number;
    temperature: number;
    power_status: string;
  }): Promise<PredictResult | null> {
    try {
      return await this.predictBreaker.fire(payload);
    } catch (err) {
      this.logger.warn(`AI Service /predict erisilemedi, fallback uygulanacak: ${(err as Error).message}`);
      return null;
    }
  }

  async assign(payload: {
    incident_id: string;
    fault_type: string;
    latitude: number | null;
    longitude: number | null;
  }): Promise<AssignResult | null> {
    try {
      return await this.assignBreaker.fire(payload);
    } catch (err) {
      this.logger.warn(`AI Service /assign erisilemedi, vaka manuel kuyruga dusecek: ${(err as Error).message}`);
      return null;
    }
  }
}
