/**
 * Policy Service for querying acceptance status and recording consent.
 */

import { apiClient } from '../api/client';
import { ACTIVE_POLICY } from '../components/policy/policyContent';

export interface PolicyStatus {
  has_accepted: boolean;
  policy_type: string;
  required_version: string;
  accepted_version: string | null;
  accepted_at: string | null;
}

export interface PolicyAcceptResult {
  success: boolean;
  policy_type: string;
  policy_version: string;
  accepted_at: string;
  message?: string;
}

export const policyService = {
  /**
   * Check whether the authenticated user has accepted the active policy.
   */
  async getStatus(): Promise<PolicyStatus> {
    return apiClient.get<PolicyStatus>('/api/v1/policy/acceptance-status');
  },

  /**
   * Explicitly accept the active platform policy version.
   */
  async acceptActivePolicy(version = ACTIVE_POLICY.version): Promise<PolicyAcceptResult> {
    return apiClient.post<PolicyAcceptResult>('/api/v1/policy/accept', {
      policy_type: ACTIVE_POLICY.type,
      policy_version: version,
    });
  },
};
