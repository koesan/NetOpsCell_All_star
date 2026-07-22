const { Server } = require("socket.io");
const amqp = require("amqplib");
const jwt = require("jsonwebtoken");
const { publicKey, JWT_ISSUER, JWT_AUDIENCE } = require("./jwt-auth.middleware");
const { buildRabbitMqUrl } = require("./common/secrets");

const EXCHANGE = "netopscell.events";
// Faz 4 (bonus): gercek zamanli bildirimler icin RabbitMQ'dan tuketilen olaylar.
// Bu olaylar zaten is-kritik tuketicilere (Gamification/AI) durable kuyruklarla ulasiyor;
// bu relay sadece UI toast'i icin ek, "en iyi caba" (best-effort) bir tuketicidir - Gateway
// yeniden baslarsa kacirilan bildirimler is mantigini etkilemez (bkz. EVENTS.md).
const RELAYED_ROUTING_KEYS = ["incident.assigned", "badge.earned"];

function verifySocketToken(token) {
  return jwt.verify(token, publicKey, {
    algorithms: ["RS256"],
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });
}

/**
 * Socket.IO sunucusunu HTTP server'a bagla ve JWT ile kimlik dogrulanan her socket'i
 * `user:<userId>` odasina yerlestir. RabbitMQ'dan gelen incident.assigned / badge.earned
 * olaylari, hedef kullaniciya (atanan teknisyen / rozet kazanan personel) ozel olarak
 * yayinlanir - broadcast degil, oda bazli hedefli teslimat.
 */
function attachWebsocket(httpServer, allowedOrigins) {
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error("CORS: izin verilmeyen origin"));
      },
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) throw new Error("token yok");
      const payload = verifySocketToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });

  connectAndRelay(io).catch(() => {
    // connectAndRelay kendi ic retry dongusune sahip; buraya yalnizca beklenmeyen bir
    // durumda dusulur ve gateway'in geri kalanini etkilememesi icin yutulur.
  });

  return io;
}

async function connectAndRelay(io) {
  let connection;
  try {
    connection = await amqp.connect(buildRabbitMqUrl());
  } catch {
    setTimeout(() => connectAndRelay(io), 5000);
    return;
  }

  connection.on("error", () => {});
  connection.on("close", () => {
    setTimeout(() => connectAndRelay(io), 5000);
  });

  const channel = await connection.createChannel();
  await channel.assertExchange(EXCHANGE, "topic", { durable: true });
  // Sunucu tarafindan uretilen, baglanti kapanınca otomatik silinen gecici kuyruk -
  // bu relay durable olmak zorunda degil (bkz. dosya basi aciklamasi).
  const { queue } = await channel.assertQueue("", { exclusive: true, autoDelete: true });
  for (const key of RELAYED_ROUTING_KEYS) {
    await channel.bindQueue(queue, EXCHANGE, key);
  }

  channel.consume(
    queue,
    (msg) => {
      if (!msg) return;
      try {
        const body = JSON.parse(msg.content.toString());
        const routingKey = msg.fields.routingKey;
        if (routingKey === "incident.assigned" && body.payload?.team_id) {
          io.to(`user:${body.payload.team_id}`).emit("incident:assigned", body.payload);
        } else if (routingKey === "badge.earned" && body.payload?.user_id) {
          io.to(`user:${body.payload.user_id}`).emit("badge:earned", body.payload);
        }
      } catch {
        // Bildirim kaybi is-kritik degil (bkz. dosya basi aciklamasi) - sessizce atlanir.
      }
    },
    { noAck: true }
  );
}

module.exports = { attachWebsocket };
