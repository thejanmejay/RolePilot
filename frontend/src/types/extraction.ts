/**
 * Types for smart profile extraction, portfolio auditing, and review.
 */

export interface ExtractedSkill {
  name: string;
  years: number;
  months: number;
  source: 'resume' | 'portfolio' | 'user';
}

export interface ExtractedExperience {
  company_name: string;
  job_title: string;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  source: 'resume' | 'portfolio' | 'user';
}

export interface ExtractedEducation {
  institution: string;
  degree?: string | null;
  field_of_study?: string | null;
  start_year?: string | null;
  end_year?: string | null;
  description?: string | null;
  source: 'resume' | 'portfolio' | 'user';
}

export interface ExtractionConflict {
  field: string;
  resume_value?: string | null;
  portfolio_value?: string | null;
  resolved_value?: string | null;
  source_options: string[];
}

export interface ExtractedProfileData {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  headline?: string | null;
  target_role?: string | null;
  about?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  website_url?: string | null;
  experience_years: number;
  experience_months: number;
  notice_period_days?: number | null;
  expected_ctc?: number | null;
}

export interface ProfileExtractionResult {
  sources: string[];
  profile: ExtractedProfileData;
  skills: ExtractedSkill[];
  experiences: ExtractedExperience[];
  educations: ExtractedEducation[];
  conflicts: ExtractionConflict[];
  warnings: string[];
  source_attribution: Record<string, string>;
  is_readable: boolean;
}

export interface ApplyExtractionRequest {
  profile: ExtractedProfileData;
  skills: ExtractedSkill[];
  experiences: ExtractedExperience[];
  educations: ExtractedEducation[];
  complete_onboarding: boolean;
}
