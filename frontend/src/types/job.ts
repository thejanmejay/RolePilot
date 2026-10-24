export interface Job {
  id: string;
  linkedin_job_id: string;
  title: string;
  company: string;
  location?: string | null;
  job_url: string;
  description?: string | null;
  employment_type?: string | null;
  experience_level?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  posted_at?: string | null;
  collected_at?: string | null;
  raw_data?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface JobFilterParams {
  search?: string;
  company?: string;
  location?: string;
  skip?: number;
  limit?: number;
}

export interface SearchConfig {
  id: string;
  user_id: string;
  name: string;
  keywords: string[] | string;
  location?: string | null;
  job_type?: string | null;
  experience_level?: string | null;
  remote_type?: string | null;
  date_posted?: string | null;
  easy_apply_only: boolean;
  salary_min?: number | null;
  salary_max?: number | null;
  max_jobs: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SearchConfigCreate {
  name: string;
  keywords: string[];
  location?: string;
  job_type?: string;
  experience_level?: string;
  remote_type?: string;
  date_posted?: string;
  easy_apply_only?: boolean;
  salary_min?: number;
  salary_max?: number;
  max_jobs?: number;
  is_active?: boolean;
}

export interface MatchAnalysis {
  matchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  experienceMatch: boolean;
  locationMatch: boolean;
}
