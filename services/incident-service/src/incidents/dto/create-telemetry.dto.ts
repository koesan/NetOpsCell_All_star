import { IsIn, IsLatitude, IsLongitude, IsNumber, IsObject, IsOptional, IsString, Max, Min, MaxLength } from "class-validator";

export class CreateTelemetryDto {
  @IsString()
  stationCode: string;

  /** Musterinin serbest metin sikayeti (opsiyonel) — vaka kaydinda saklanir. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  /** Gemini on analizi (frontend, AI Service /analyze-complaint'ten alip iletir).
   * Salt bilgilendirme amaclidir; onceliklendirme/atama kararlarina girmez. */
  @IsOptional()
  @IsObject()
  complaintAnalysis?: Record<string, unknown>;

  @IsLatitude()
  latitude: number;

  @IsLongitude()
  longitude: number;

  @IsNumber()
  @Min(-130)
  @Max(0)
  signalStrength: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  packetLoss: number;

  @IsNumber()
  @Min(-40)
  @Max(150)
  temperature: number;

  @IsIn(["NORMAL", "UNSTABLE", "OUTAGE"])
  powerStatus: string;
}
