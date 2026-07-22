import { IsIn, IsLatitude, IsLongitude, IsNumber, IsString, Max, Min } from "class-validator";

export class CreateTelemetryDto {
  @IsString()
  stationCode: string;

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
