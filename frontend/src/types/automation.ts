export interface SearchConfigSummary {
  id: string;
  name: string;
  keywords: string[] | string;
  location?: string;
  remote_type?: string;
  job_type?: string;
}

export interface AutomationRun {
  id: string;
  user_id: string;
  search_config_id?: string | null;
  search_config?: SearchConfigSummary | null;
  search_overrides?: AutomationSearchOverrides | null;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | string;
  dry_run?: boolean;
  allow_live_submission?: boolean;
  jobs_found: number;
  jobs_processed: number;
  applications_submitted: number;
  applications_failed: number;
  applications_skipped: number;
  error_message?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_at: string;
}

export interface AutomationLog {
  id: number;
  run_id: string;
  application_id?: string | null;
  level: 'info' | 'warning' | 'error' | 'debug' | string;
  event: string;
  message?: string | null;
  metadata_json?: Record<string, any> | null;
  created_at: string;
}

export interface AutomationRunCreate {
  search_config_id?: string;
  search_overrides?: AutomationSearchOverrides;
  selected_synced_job_ids?: string[];
  resume_id?: string;
  idempotency_key?: string;
  dry_run?: boolean;
  max_jobs?: number;
  allow_live_submission?: boolean;
  live_submission_confirmation?: string;
}

export interface AutomationSearchOverrides {
  keywords?: string | string[];
  location?: string;
  job_type?: string;
  experience_level?: string;
  remote_type?: string;
  date_posted?: string;
  easy_apply_only?: boolean;
}
