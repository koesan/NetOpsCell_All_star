import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateResolutionDto {
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  resolutionNote: string;
}

export class RateResolutionDto {
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsBoolean()
  isPermanent: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
