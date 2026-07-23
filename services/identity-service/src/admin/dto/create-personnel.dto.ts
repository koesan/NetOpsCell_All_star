import { ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { Role } from "../../common/enums/role.enum";

export class CreatePersonnelDto {
  @IsString()
  @MinLength(2, { message: "Ad en az 2 karakter olmalıdır." })
  name: string;

  @IsString()
  @MinLength(2, { message: "Soyad en az 2 karakter olmalıdır." })
  surname: string;

  @IsEmail({}, { message: "Geçerli bir e-posta adresi giriniz." })
  email: string;

  @IsString()
  @MinLength(8, { message: "Şifre en az 8 karakter olmalıdır." })
  @Matches(/[A-Z]/, { message: "Şifre en az 1 büyük harf içermelidir (A-Z)." })
  @Matches(/\d/, { message: "Şifre en az 1 rakam içermelidir (0-9)." })
  @Matches(/[^A-Za-z0-9]/, { message: "Şifre en az 1 özel karakter içermelidir." })
  password: string;

  @IsEnum(Role, { message: "Geçerli bir personel rolü seçiniz." })
  role: Role;

  @IsOptional()
  @IsArray()
  expertise?: string[];

  @IsOptional()
  @IsArray()
  region?: string[];

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
