import { ObjectId } from "mongodb";

export type MessageStatus = "SENT" | "DELIVERED" | "READ";
export type MessageType = "TEXT" | "SYSTEM" | "AI_ANALYSIS";

/** Gemini sikayet on analizi ciktisi (bkz. AI Service app/llm/gemini.py) — AI_ANALYSIS
 * tipindeki mesajlarda content'e ek olarak yapilandirilmis alanlar da tasinir. */
export interface ChatComplaintAnalysis {
  muhtemel_alan: string;
  olasi_neden: string;
  oneri: string;
  guven: number;
  model?: string;
}

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
  /** Gonderenin gorunen adi (JWT'deki name claim'i). SYSTEM mesajlarinda "Sistem". */
  senderName?: string;
  content: string;
  /** Yalnizca messageType === "AI_ANALYSIS" icin doldurulur. */
  analysis?: ChatComplaintAnalysis;
  messageType: MessageType;
  status: MessageStatus;
  readBy: ReadReceipt[];
  createdAt: Date;
}
