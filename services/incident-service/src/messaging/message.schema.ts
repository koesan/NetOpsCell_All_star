import { ObjectId } from "mongodb";

export type MessageStatus = "SENT" | "DELIVERED" | "READ";
export type MessageType = "TEXT" | "SYSTEM";

export interface ReadReceipt {
  userId: string;
  readAt: Date;
}

/** MongoDB dokuman semasi - saha teknisyeni <-> NOC iletisim thread'i.
 * Bkz. docs/ARCHITECTURE.md Bolum 20 (Mesajlasma Mimarisi - veri modeli). */
export interface MessageDocument {
  _id?: ObjectId;
  incidentId: string;
  senderId: string;
  senderRole: string;
  content: string;
  messageType: MessageType;
  status: MessageStatus;
  readBy: ReadReceipt[];
  createdAt: Date;
}
