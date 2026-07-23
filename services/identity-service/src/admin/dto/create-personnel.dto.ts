import { ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { Role } from "../../common/enums/role.enum";

export class CreatePersonnelDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  surname: string;

  @IsEmail({}, { message: "Gecerli bir e-posta adresi giriniz." })
  email: string;

  @IsString()
  @MinLength(8, { message: "Şifre en az 8 karakter olmalıdır." })
  @Matches(/[A-Z]/, { message: "Şifre en az 1 büyük harf içermelidir (A-Z)." })
  @Matches(/\d/, { message: "Şifre en az 1 rakam içermelidir (0-9)." })
  @Matches(/[^A-Za-z0-9]/, { message: "Şifre en az 1 özel karakter içermelidir." })
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
