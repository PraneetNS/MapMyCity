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
