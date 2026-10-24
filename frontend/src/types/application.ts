import type { Job } from './job';

export type ApplicationLifecycleStatus =
  | 'pending'
  | 'dry_run_completed'
  | 'submission_attempted'
  | 'applied'
  | 'submission_failed'
  | 'skipped'
  | 'failed'
  // Pipeline management statuses
  | 'saved'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn'
  | string;

export interface ApplicationAnswer {
  id: string;
  application_id: string;
  question: string;
  answer: string;
  question_type?: 'numeric' | 'boolean' | 'select' | 'document' | 'text' | string | null;
  answer_source?: string | null;
  confidence?: number | null;
  created_at: string;
}

export interface Application {
  id: string;
  user_id: string;
  job_id: string;
  run_id?: string | null;
  status: ApplicationLifecycleStatus;
  attempt_count: number;
  application_url?: string | null;
  started_at?: string | null;
  submitted_at?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
  job?: Job | null;
  answers?: ApplicationAnswer[];
}

export interface ApplicationCreate {
  job_id: string;
  status?: string;
  application_url?: string;
  error_message?: string;
}

export interface ApplicationUpdate {
  status?: string;
  application_url?: string;
  error_message?: string;
}
