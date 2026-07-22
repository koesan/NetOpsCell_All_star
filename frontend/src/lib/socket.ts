import { io, type Socket } from "socket.io-client";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

let socket: Socket | null = null;

/**
 * Faz 4 (bonus): Gateway'deki Socket.IO relay'e JWT ile baglanir (bkz. gateway/src/websocket.js).
 * Ayni access token REST istekleri icin de kullanilir; token yenilenirse (refresh) yeni
 * baglanti icin tekrar connectSocket cagirilmalidir (bkz. useRealtimeNotifications).
 */
export function connectSocket(token: string): Socket {
  if (socket) socket.disconnect();
  socket = io(API_BASE_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnectionDelay: 2000,
  });
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
