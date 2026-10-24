export interface Skill {
  id: string;
  user_id: string;
  name: string;
  years: number;
  months: number;
  created_at?: string;
  updated_at?: string;
}

export interface SkillCreate {
  name: string;
  years: number;
  months: number;
}

export interface BulkSkillsCreate {
  skills: SkillCreate[];
}

export interface Experience {
  id: string;
  user_id: string;
  company_name: string;
  job_title: string;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExperienceCreate {
  company_name: string;
  job_title: string;
  start_date?: string | null;
  end_date?: string | null;
  description?: string | null;
}

export interface Education {
  id: string;
  user_id?: string;
  degree?: string | null;
  institution: string;
  field_of_study?: string | null;
  start_year?: string | null;
  end_year?: string | null;
  description?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EducationCreate {
  institution: string;
  degree?: string | null;
  field_of_study?: string | null;
  start_year?: string | null;
  end_year?: string | null;
  description?: string | null;
}

export interface Certification {
  id?: string;
  name: string;
  issuing_org: string;
  issue_date?: string;
  credential_url?: string;
}

export interface Profile {
  id: string;
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
  experience_years?: number | null;
  experience_months?: number | null;
  notice_period_days?: number | null;
  current_ctc?: number | null;
  expected_ctc?: number | null;
  authorized_to_work?: boolean | null;
  willing_to_relocate?: boolean | null;
  onboarding_completed?: boolean;
  onboarding_completed_at?: string | null;
  skills: Skill[];
  experiences: Experience[];
  educations?: Education[];
  created_at?: string;
  updated_at?: string;
}

export interface Resume {
  id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  version: number;
  is_active: boolean;
  parsed_text?: string | null;
  parsed_data?: Record<string, any> | null;
  created_at: string;
}

export interface ProfileUpdate {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  headline?: string | null;
  target_role?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  website_url?: string | null;
  experience_years?: number | null;
  experience_months?: number | null;
  notice_period_days?: number | null;
  current_ctc?: number | null;
  expected_ctc?: number | null;
  authorized_to_work?: boolean | null;
  willing_to_relocate?: boolean | null;
  onboarding_completed?: boolean;
}

export interface OnboardingData {
  full_name?: string;
  first_name?: string;
  last_name?: string;
  headline: string;
  target_role: string;
  experience_years: number;
  city?: string;
  country?: string;
  phone?: string;
}

