export interface Submission {
  id: string;
  device_id: string;
  mission_type: string;
  photo_url: string;
  latitude: number;
  longitude: number;
  captured_at: string;
  submitted_at: string;
  status:
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'acknowledged'
    | 'in_progress'
    | 'resolved_pending_verification'
    | 'verified_fixed'
    | 'reopened';
  notes?: string | null;
  trust_score?: number;
  devices?: {
    trust_score: number;
  } | null;
  flags?: string[] | null;
  cluster_id?: string | null;
  resolution_photo_url?: string | null;
}

export interface SmartDigestData {
  user_id: string;
  ward_name: string;
  summary_text: string;
  resolved_count: number;
  in_progress_count: number;
  acknowledged_count: number;
  upvotes_received: number;
  reporter_percentile: string;
  active_streak_weeks: number;
  badge_msg: string;
}

export interface NoteImprovementResponse {
  success: boolean;
  original_note: string;
  suggested_note: string;
  category: string;
  remaining_quota: number;
}

