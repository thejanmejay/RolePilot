import { apiClient } from './client';
import type {
  LinkedInStatus,
  LinkedInConsentResponse,
  LinkedInActionResponse,
} from '../types/linkedin';

export const linkedinApi = {
  /**
   * Retrieve the current user's LinkedIn connection state and active consent.
   */
  getStatus: async (): Promise<LinkedInStatus> => {
    return apiClient.get<LinkedInStatus>('/api/v1/linkedin/status');
  },

  /**
   * Securely submit or update candidate's LinkedIn session token.
   * Token is encrypted on the server; never stored in localStorage.
   */
  connect: async (
    sessionToken: string,
    profileUrl?: string
  ): Promise<LinkedInStatus> => {
    return apiClient.post<LinkedInStatus>('/api/v1/linkedin/connect', {
      session_token: sessionToken,
      linkedin_profile_url: profileUrl || undefined,
    });
  },

  /**
   * Record explicit candidate permission and automation purpose consent.
   */
  submitConsent: async (
    accepted: boolean,
    policyVersion: string = 'v1.0'
  ): Promise<LinkedInConsentResponse> => {
    return apiClient.post<LinkedInConsentResponse>('/api/v1/linkedin/consent', {
      accepted,
      policy_version: policyVersion,
    });
  },

  /**
   * Wipe stored session credentials and mark account disconnected.
   */
  disconnect: async (): Promise<LinkedInActionResponse> => {
    return apiClient.post<LinkedInActionResponse>('/api/v1/linkedin/disconnect', {});
  },

  /**
   * Revoke automation consent and disconnect stored session.
   */
  revokeConsent: async (): Promise<LinkedInActionResponse> => {
    return apiClient.post<LinkedInActionResponse>('/api/v1/linkedin/revoke-consent', {});
  },
};
