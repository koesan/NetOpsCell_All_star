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
  name?: string;
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

export interface AssignmentCandidate {
  team_id: string;
  name: string | null;
  score: number;
  uzmanlik_eslesme: number;
  mesafe_yakinlik: number;
  bosluk_orani: number;
  distance_km: number | null;
  has_capacity: boolean;
}

export interface AssignmentDetail {
  method?: "AI" | "MANUEL";
  score?: number;
  uzmanlik_eslesme?: number;
  mesafe_yakinlik?: number;
  bosluk_orani?: number;
  distance_km?: number | null;
  candidates?: AssignmentCandidate[];
  candidates_evaluated?: number;
}

export interface ComplaintAnalysis {
  muhtemel_alan: FaultType;
  olasi_neden: string;
  oneri: string;
  guven: number;
  model?: string;
}

export interface EscalationRisk {
  risk: "DUSUK" | "ORTA" | "YUKSEK";
  probabilities: Record<string, number>;
  model_version: string;
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
  customerNote: string | null;
  complaintAnalysis: ComplaintAnalysis | null;
  assignedTeamId: string | null;
  assignedTeamName: string | null;
  assignedTeamLat: number | null;
  assignedTeamLng: number | null;
  assignmentDetail: AssignmentDetail | null;
  etaTravelMinutes: number | null;
  etaWorkMinutes: number | null;
  etaTotalMinutes: number | null;
  departedAt: string | null;
  arrivedAt: string | null;
  aiProbability: number | null;
  slaDeadline: string | null;
  slaExceededNotified: boolean;
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface Station {
  id: string;
  code: string;
  name: string;
  district: string;
  region: string;
  latitude: number;
  longitude: number;
  technology: string;
  coverageUsers: number;
}

export interface TeamInfo {
  team_id: string;
  name: string | null;
  expertise: string[];
  region: string[];
  lat: number | null;
  lng: number | null;
  active_incidents: number;
  max_capacity: number;
  available: boolean;
}

export interface IncidentHistoryEntry {
  id: string;
  incidentId: string;
  fromStatus: IncidentStatus;
  toStatus: IncidentStatus;
  changedBy: string | null;
  reason: string | null;
  changedAt: string;
}

export interface IncidentMessage {
  _id: string;
  incidentId: string;
  senderId: string;
  senderRole: Role | "SYSTEM" | "AI";
  senderName?: string;
  content: string;
  messageType: "TEXT" | "SYSTEM" | "AI_ANALYSIS";
  status: "SENT" | "DELIVERED" | "READ";
  readBy: { userId: string; readAt: string }[];
  createdAt: string;
  /** Yalnizca messageType === "AI_ANALYSIS" icin doldurulur. */
  analysis?: ComplaintAnalysis;
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

export interface PriorityTrendPoint {
  day: string;
  KRITIK: number;
  YUKSEK: number;
  ORTA: number;
  DUSUK: number;
}

export interface DashboardSummary {
  faultTypeDistribution: { faultType: FaultType; count: string }[];
  priorityDistribution: { priority: Priority; count: string }[];
  priorityTrend: PriorityTrendPoint[];
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
  false_alarms: number;
  false_alarm_rate_percent: number;
}

export interface CategoryAccuracy {
  fault_type: string;
  total: number;
  misclassified: number;
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
