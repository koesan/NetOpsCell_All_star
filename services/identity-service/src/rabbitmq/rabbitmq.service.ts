import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import * as amqp from "amqplib";
import { buildRabbitMqUrl } from "../common/secrets";

export const EXCHANGE = "netopscell.events";
export const DLX = "netopscell.events.dlx";
export const DLQ = "netopscell.events.dlq";

export type EventHandler = (routingKey: string, payload: Record<string, unknown>) => Promise<void>;

/**
 * Faz 2: netopscell.events (topic exchange, durable) uzerinden gercek publish/consume.
 * Bkz. docs/ARCHITECTURE.md Bolum 7, EVENTS.md.
 *
 * Baglanti, provider constructor'inda hemen baslatilir (NestJS OnModuleInit lifecycle
 * sirasina guvenmek yerine): DI, provider'lari onModuleInit hook'larindan ONCE construct
 * eder, bu yuzden constructor'da baslayan baglanti, bu servise bagimli TUM tuketicilerin
 * (orn. GamificationConsumerService.onModuleInit) hazir olmasindan once garanti baslamis
 * olur. publish()/consume() `ready` promise'ini bekleyerek baglanti sirasi konusundaki
 * belirsizligi tamamen ortadan kaldirir.
 */
@Injectable()
export class RabbitMQService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQService.name);
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private ready: Promise<void>;

  constructor() {
    this.ready = this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      // kapanista hata yok sayilir
    }
  }

  private async connect(): Promise<void> {
    const url = buildRabbitMqUrl();
    try {
      this.connection = await amqp.connect(url);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(EXCHANGE, "topic", { durable: true });
      await this.channel.assertExchange(DLX, "fanout", { durable: true });
      await this.channel.assertQueue(DLQ, { durable: true });
      await this.channel.bindQueue(DLQ, DLX, "");

      this.connection.on("error", (err) => this.logger.warn(`RabbitMQ baglanti hatasi: ${err.message}`));
      this.connection.on("close", () => {
        this.logger.warn("RabbitMQ baglantisi kapandi, 5sn sonra yeniden denenecek");
        this.channel = null;
        this.ready = new Promise((resolve) => {
          setTimeout(() => this.connect().then(resolve), 5000);
        });
      });

      this.logger.log("RabbitMQ baglantisi kuruldu ve exchange/DLQ hazir");
    } catch (err) {
      this.logger.warn(`RabbitMQ'ya baglanilamadi, 5sn sonra tekrar denenecek: ${(err as Error).message}`);
      await new Promise((resolve) => setTimeout(resolve, 5000));
      await this.connect();
    }
  }

  async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    await this.ready;
    if (!this.channel) {
      this.logger.warn(`Kanal yok, event kaybedildi: ${routingKey}`);
      return;
    }
    const message = { event_type: routingKey, timestamp: new Date().toISOString(), payload };
    this.channel.publish(EXCHANGE, routingKey, Buffer.from(JSON.stringify(message)), { persistent: true });
  }

  /** queueName'i routingKeys ile exchange'e baglar, mesajlari handler'a iletir.
   * Basarili islem sonrasi ack; hata durumunda dogrudan DLQ'ya (requeue=false). */
  async consume(queueName: string, routingKeys: string[], handler: EventHandler): Promise<void> {
    await this.ready;
    if (!this.channel) {
      this.logger.warn(`Kanal yok, consumer baslatilamadi: ${queueName}`);
      return;
    }
    await this.channel.assertQueue(queueName, { durable: true, deadLetterExchange: DLX });
    for (const key of routingKeys) {
      await this.channel.bindQueue(queueName, EXCHANGE, key);
    }
    await this.channel.consume(queueName, async (msg) => {
      if (!msg) return;
      try {
        const body = JSON.parse(msg.content.toString());
        await handler(msg.fields.routingKey, body.payload);
        this.channel!.ack(msg);
      } catch (err) {
        this.logger.error(`Event isleme hatasi (${msg.fields.routingKey}), DLQ'ya gonderiliyor: ${(err as Error).message}`);
        this.channel!.nack(msg, false, false);
      }
    });
    this.logger.log(`Consumer basladi: ${queueName} <- [${routingKeys.join(", ")}]`);
  }
}
