import { IsEmail, IsOptional, IsString, Matches, MinLength } from "class-validator";

export class RegisterDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  surname: string;

  @Matches(/^0?5\d{9}$/, { message: "Gecerli bir Turkiye GSM numarasi giriniz (orn. 05XXXXXXXXX)." })
  gsm: string;

  @IsOptional()
  @IsEmail({}, { message: "Gecerli bir e-posta adresi giriniz." })
  email?: string;
}
