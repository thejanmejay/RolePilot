import { apiClient } from './client';

export interface ATSFinding {
  id: string;
  severity: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  evidence: string;
  why_it_matters: string;
  recommendation: string;
}

export interface ATSSubscores {
  extractability: number;
  sections: number;
  content: number;
  impact: number;
}

export interface ATSMetrics {
  page_count: number;
  word_count: number;
  tables_detected: number;
  keywords_detected?: number;
  action_verbs_detected?: number;
}

export interface ATSAnalysisResult {
  overall_score: number;
  grade: string;
  summary: string;
  subscores: ATSSubscores;
  metrics: ATSMetrics;
  findings: ATSFinding[];
  extracted_text_preview?: string;
}

export async function checkResumeATS(file: File): Promise<ATSAnalysisResult> {
  const formData = new FormData();
  formData.append('file', file);

  return apiClient.post<ATSAnalysisResult>('/api/v1/resumes/ats-check', formData);
}
