export type Role = "MUSTERI" | "SAHA_TEKNISYENI" | "NOC_OPERATORU" | "SUPERVIZOR" | "ADMIN";

export type IncidentStatus =
  | "YENI"
  | "ATANDI"
  | "YOLDA"
  | "MUDAHALE_EDILIYOR"
  | "PARCA_BEKLENIYOR"
  | "COZULDU"
  | "KAPANDI";

export type FaultType = "DONANIM" | "GUC_KESINTISI" | "BAGLANTI" | "YAZILIM" | "ISINMA" | "BELIRSIZ";

export type Priority = "DUSUK" | "ORTA" | "YUKSEK" | "KRITIK";

export type Level = "BRONZ" | "GUMUS" | "ALTIN" | "PLATIN";

export interface AccessTokenPayload {
  sub: string;
  role: Role;
  expertise?: string[];
  region?: string[];
}

export interface AuthUser {
  id: string;
  role: Role;
  name?: string;
  surname?: string;
  email?: string | null;
  gsm?: string | null;
  expertise?: string[] | null;
  region?: string[] | null;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export interface Incident {
  id: string;
  incidentNo: string;
  stationCode: string;
  latitude: number | null;
  longitude: number | null;
  faultType: FaultType;
  priority: Priority;
  status: IncidentStatus;
  customerId: string;
  assignedTeamId: string | null;
  aiProbability: number | null;
  slaDeadline: string | null;
  slaExceededNotified: boolean;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface IncidentMessage {
  _id: string;
  incidentId: string;
  senderId: string;
  senderRole: Role;
  content: string;
  messageType: "TEXT" | "SYSTEM";
  status: "SENT" | "DELIVERED" | "READ";
  readBy: { userId: string; readAt: string }[];
  createdAt: string;
}

export interface IncidentResolution {
  id: string;
  incidentId: string;
  resolutionNote: string;
  ratedBy: string | null;
  rating: number | null;
  isPermanent: boolean | null;
  ratedAt: string | null;
  createdAt: string;
}

export interface GamificationProfile {
  userId: string;
  totalPoints: number;
  level: Level;
  resolvedCount: number;
  averagePoints: number;
  badges: string[];
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  points: number;
}

export interface BadgeCatalogItem {
  code: string;
  name: string;
  condition: string;
}

export interface DashboardSummary {
  faultTypeDistribution: { faultType: FaultType; count: string }[];
  priorityDistribution: { priority: Priority; count: string }[];
  sla: {
    complianceRatePercent: number;
    totalResolved: number;
    exceededActiveCount: number;
    exceededActive: Incident[];
  };
  fieldTeamPerformance: {
    teamId: string;
    resolvedCount: number;
    avgResponseSeconds: number | null;
    repeatRatePercent: number;
  }[];
  pendingAssignmentQueue: Incident[];
}

export interface AiAccuracy {
  total_predictions: number;
  misclassifications: number;
  accuracy_percent: number;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  actionType: string;
  ip: string | null;
  result: "SUCCESS" | "FAILURE";
  detail: Record<string, unknown> | null;
  timestamp: string;
}

export interface Personnel {
  id: string;
  role: Role;
  name: string;
  surname: string;
  email: string | null;
  expertise: string[] | null;
  region: string[] | null;
  status: string;
  createdAt: string;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: string[] } | null;
}
