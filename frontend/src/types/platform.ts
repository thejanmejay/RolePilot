/**
 * Multi-Platform Architecture Types & Shared Contracts
 * 
 * Defines standard contracts for job platform identity, capabilities,
 * connection lifecycle, and credential schemas across RolePilot integrations.
 */

export type PlatformId = 'linkedin' | 'indeed' | 'wellfound';

export type PlatformStatus = 'connected' | 'disconnected' | 'expired' | 'coming_soon' | 'error';

export type AuthType = 'session_cookie' | 'oauth2' | 'api_key';

export interface PlatformCapability {
  id: string;
  name: string;
  description: string;
  supported: boolean;
}

export interface PlatformConfig {
  id: PlatformId;
  name: string;
  tagline: string;
  status: PlatformStatus;
  isSupported: boolean;
  authType: AuthType;
  credentialName: string;
  credentialDescription: string;
  instructions: string[];
  capabilities: PlatformCapability[];
  accountIdentifier?: string | null;
  lastConnectedAt?: string | null;
  hasConsent?: boolean;
}

/**
 * Canonical platform catalog defining supported and roadmap integrations.
 * Platform-specific credentials, selectors, and browser automation logic
 * remain isolated within platform-specific workers and adapters.
 */
export const PLATFORM_CATALOG: PlatformConfig[] = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    tagline: 'Automated Easy Apply submission and role qualification scoring',
    status: 'disconnected',
    isSupported: true,
    authType: 'session_cookie',
    credentialName: 'li_at session cookie',
    credentialDescription: 'HTTP-only session cookie for authenticated browser automation',
    instructions: [
      'Log into your LinkedIn account in your desktop browser.',
      'Open Developer Tools by pressing F12 (or Option + Cmd + I on macOS).',
      'Select the Application tab (Storage tab in Firefox).',
      'In the left sidebar, expand Cookies and click https://www.linkedin.com.',
      'Find the cookie named li_at and copy its Value (starts with AQED...).',
    ],
    capabilities: [
      {
        id: 'easy_apply',
        name: 'Easy Apply Automation',
        description: 'Multi-step form field population and pre-staged questionnaires',
        supported: true,
      },
      {
        id: 'job_discovery',
        name: 'Autonomous Job Discovery',
        description: 'Keyword, title, and location-based job listing extraction',
        supported: true,
      },
      {
        id: 'readiness_audit',
        name: 'Qualification Audit',
        description: 'Role requirement matching against candidate qualifications',
        supported: true,
      },
      {
        id: 'external_redirect',
        name: 'External Company Portal Apply',
        description: 'Automated application across arbitrary third-party ATS sites',
        supported: false,
      },
    ],
  },
  {
    id: 'indeed',
    name: 'Indeed',
    tagline: 'Indeed Apply integration for high-volume role matching',
    status: 'coming_soon',
    isSupported: false,
    authType: 'oauth2',
    credentialName: 'Indeed OAuth / Session',
    credentialDescription: 'Direct Indeed integration via OAuth2',
    instructions: [
      'Indeed integration is currently in active architecture planning.',
      'OAuth2 authorization flow will be provided upon public availability.',
    ],
    capabilities: [
      {
        id: 'easy_apply',
        name: 'Indeed Apply Automation',
        description: 'Structured form traversal on Indeed Apply postings',
        supported: false,
      },
      {
        id: 'job_discovery',
        name: 'Job Discovery',
        description: 'Indeed search extraction by title and location',
        supported: false,
      },
    ],
  },
  {
    id: 'wellfound',
    name: 'Wellfound (AngelList)',
    tagline: 'Startup and tech ecosystem job applications',
    status: 'coming_soon',
    isSupported: false,
    authType: 'oauth2',
    credentialName: 'Wellfound Token',
    credentialDescription: 'Startup role discovery and direct messaging',
    instructions: [
      'Wellfound integration is planned for an upcoming platform release.',
    ],
    capabilities: [
      {
        id: 'job_discovery',
        name: 'Startup Job Discovery',
        description: 'Startup role listings by funding stage and tech stack',
        supported: false,
      },
    ],
  },
];
