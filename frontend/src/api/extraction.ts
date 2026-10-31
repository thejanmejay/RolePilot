import { apiClient } from './client';
import type {
  ApplyExtractionRequest,
  ProfileExtractionResult,
} from '../types/extraction';
import type { Profile } from '../types/profile';

export const extractionApi = {
  /**
   * Extract candidate profile data from an uploaded resume and/or public portfolio URL.
   */
  extractProfile: async (
    resumeFile?: File | null,
    portfolioUrl?: string | null,
    options?: {
      signal?: AbortSignal;
      onUploadProgress?: (progressPct: number) => void;
    }
  ): Promise<ProfileExtractionResult> => {
    const formData = new FormData();
    if (resumeFile) {
      formData.append('resume', resumeFile);
    }
    if (portfolioUrl && portfolioUrl.trim()) {
      formData.append('portfolio_url', portfolioUrl.trim());
    }

    return apiClient.post<ProfileExtractionResult>(
      '/api/v1/profile/extract',
      formData,
      {
        signal: options?.signal,
      }
    );
  },

  /**
   * Apply confirmed and reviewed extraction results to candidate profile.
   */
  applyExtraction: async (payload: ApplyExtractionRequest): Promise<Profile> => {
    return apiClient.post<Profile>('/api/v1/profile/apply-extraction', payload);
  },
};
