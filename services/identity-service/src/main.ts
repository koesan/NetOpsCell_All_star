import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

const ALLOWED_ORIGINS = (process.env.CORS_ALLOWED_ORIGINS || "http://localhost:3000").split(",").map((o) => o.trim());

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // Bu servise tek giris noktasi Gateway'dir (Docker network'unde tek hop) - Gateway'in ilettigi
  // X-Forwarded-For'a guvenilmezse req.ip her zaman Gateway container'inin Docker-ici IP'sini
  // dondurur ve audit log'daki gercek istemci IP'si hicbir zaman dogru olmaz.
  app.set("trust proxy", 1);
  app.use(helmet());
  // Faz 3: CORS artik acik (*) degil - sadece bilinen frontend/gateway origin'lerine izin verilir.
  app.enableCors({ origin: ALLOWED_ORIGINS, credentials: true });
  app.setGlobalPrefix("api/v1", { exclude: ["health", "internal/teams"] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle("Identity Service")
    .setDescription(
      "NetOpsCell - Kimlik dogrulama, rol/yetki yonetimi, token yonetimi, audit log"
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[identity-service] listening on port ${port}`);
}

bootstrap();
