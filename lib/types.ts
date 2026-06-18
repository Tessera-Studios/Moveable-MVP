export type UserRole = "provider" | "patient";

export interface Profile {
  id: string;
  role: UserRole;
  provider_id: string | null;
  created_at: string;
}

export interface InvitationCode {
  code: string;
  provider_id: string;
  is_consumed: boolean;
  created_at: string;
  expires_at: string | null;
}

export interface SessionTemplate {
  id: string;
  provider_id: string;
  patient_id: string;
  name: string;
  provider_notes: string | null;
  created_at: string;
}

export interface Exercise {
  id: string;
  session_template_id: string;
  name: string;
  sets: number;
  reps: number;
  patient_notes: string | null;
  sort_order: number;
  video_id: string | null;
}

export interface SessionExecution {
  id: string;
  session_template_id: string;
  patient_id: string;
  status: "pending" | "completed";
  ease_score: number | null;
  pain_score: number | null;
  completed_at: string | null;
}

export interface Video {
  id: string;
  uploader_id: string;
  exercise_id: string | null;
  storage_path: string;
  created_at: string;
}

export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  media_url: string | null;
  created_at: string;
  is_read: boolean;
}

export type ClientMessage = Message & {
  _optimistic?: boolean;
  _status?: "sending" | "sent" | "failed";
};

export interface ConversationRow {
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface PatientStats {
  streak: number;
  totalCompleted: number;
  recentCompletions: { date: string; completed: boolean }[];
  painScores: { date: string; score: number }[];
  easeScores: { date: string; score: number }[];
}
