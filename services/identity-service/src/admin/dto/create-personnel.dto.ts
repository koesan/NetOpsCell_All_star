import { ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { Role } from "../../common/enums/role.enum";

const PASSWORD_POLICY_REGEX = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export class CreatePersonnelDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  surname: string;

  @IsEmail({}, { message: "Gecerli bir e-posta adresi giriniz." })
  email: string;

  @Matches(PASSWORD_POLICY_REGEX, {
    message: "Sifre en az 8 karakter, 1 buyuk harf, 1 rakam ve 1 ozel karakter icermelidir.",
  })
  password: string;

  @IsEnum(Role, { message: "Gecerli bir personel rolu seciniz." })
  role: Role;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  expertise?: string[];

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  region?: string[];

  @IsOptional()
  latitude?: number;

  @IsOptional()
  longitude?: number;
}
