import { ArrayNotEmpty, IsArray, IsEmail, IsEnum, IsIsIn, IsNumber, IsOptional, IsString, Matches, MinLength } from "class-validator";
import { Role } from "../../common/enums/role.enum";
import { UserStatus } from "../../common/enums/user-status.enum";

const STAFF_ROLES = [Role.SAHA_TEKNISYENI, Role.NOC_OPERATORU, Role.SUPERVIZOR, Role.ADMIN];

export class UpdatePersonnelDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  surname?: string;

  @IsOptional()
  @IsEmail({}, { message: "Gecerli bir e-posta adresi giriniz." })
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: "Şifre en az 8 karakter olmalıdır." })
  @Matches(/[A-Z]/, { message: "Şifre en az 1 büyük harf içermelidir (A-Z)." })
  @Matches(/\d/, { message: "Şifre en az 1 rakam içermelidir (0-9)." })
  @Matches(/[^A-Za-z0-9]/, { message: "Şifre en az 1 özel karakter içermelidir." })
  password?: string;

  @IsOptional()
  @IsEnum(Role, { message: "Gecerli bir personel rolu seciniz." })
  role?: Role;

  @IsOptional()
  @IsArray()
  expertise?: string[];

  @IsOptional()
  @IsArray()
  region?: string[];

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @IsNumber()
  longitude?: number;
}
