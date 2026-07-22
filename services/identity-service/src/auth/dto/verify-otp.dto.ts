import { IsString, Length, Matches } from "class-validator";

export class VerifyOtpDto {
  @Matches(/^0?5\d{9}$/, { message: "Gecerli bir Turkiye GSM numarasi giriniz." })
  gsm: string;

  @IsString()
  @Length(4, 4, { message: "OTP kodu 4 haneli olmalidir." })
  code: string;
}
