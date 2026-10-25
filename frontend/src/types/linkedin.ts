export interface LinkedInStatus {
  is_connected: boolean;
  status: 'connected' | 'disconnected' | 'expired' | 'error';
  has_consent: boolean;
  consent_version: string | null;
  consent_accepted_at: string | null;
  last_login_at: string | null;
  linkedin_profile_url: string | null;
}

export interface LinkedInConsentResponse {
  success: boolean;
  policy_version: string;
  accepted_at: string;
}

export interface LinkedInActionResponse {
  success: boolean;
  status: string;
  message: string;
}
