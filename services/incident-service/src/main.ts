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
  // dondurur ve audit.log event'lerindeki gercek istemci IP'si hicbir zaman dogru olmaz.
  app.set("trust proxy", 1);
  app.use(helmet());
  app.enableCors({ origin: ALLOWED_ORIGINS, credentials: true });
  app.setGlobalPrefix("api/v1", { exclude: ["health", "internal/teams/workload"] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const config = new DocumentBuilder()
    .setTitle("Incident Service")
    .setDescription(
      "NetOpsCell - Ariza yasam dongusu, SLA takibi, saha iletisimi"
    )
    .setVersion("0.1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("docs", app, document);

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3002;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[incident-service] listening on port ${port}`);
}

bootstrap();
