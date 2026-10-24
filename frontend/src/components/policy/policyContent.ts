/**
 * Platform Policy and Terms of Use Content Configuration.
 * 
 * Configurable terms document for RolePilot.
 * The legal terms are kept in this standalone configuration file so they
 * can be updated or replaced without altering the consent workflow or database tracking.
 */

export interface PolicyDocument {
  version: string;
  type: string;
  title: string;
  subtitle: string;
  lastUpdated: string;
  sections: Array<{
    title: string;
    content: string;
  }>;
}

export const ACTIVE_POLICY: PolicyDocument = {
  version: 'draft-1',
  type: 'platform_terms',
  title: 'Platform Policy and Terms of Use',
  subtitle: 'Please review and accept our platform policies before using RolePilot.',
  lastUpdated: 'October 2026',
  sections: [
    {
      title: '1. Automated Application Assistance',
      content:
        'RolePilot is an automated workflow tool designed to assist candidates with discovering job opportunities and streamlining job applications. By using this service, you acknowledge that you retain sole responsibility for reviewing and verifying all application materials submitted on your behalf.',
    },
    {
      title: '2. Accuracy of Candidate Representation',
      content:
        'You certify that all resume data, employment history, contact details, work authorizations, and custom screening answers provided to RolePilot are accurate, truthful, and representative of your actual qualifications.',
    },
    {
      title: '3. Data Privacy and Local Storage',
      content:
        'Your profile information, resumes, search configurations, and application logs are processed securely. Authentication credentials and session tokens are stored in compliance with modern security standards. You may review, modify, or export your profile information at any time.',
    },
    {
      title: '4. Ethical Automation and Platform Compliance',
      content:
        'To protect candidate accounts and maintain platform integrity, RolePilot incorporates strict rate limits, human-like pacing, and mandatory application confirmation guards. You agree not to disable, circumvent, or manipulate safety guards or automated limits.',
    },
    {
      title: '5. Account Responsibility & Liability',
      content:
        'You are responsible for maintaining the confidentiality of your credentials. RolePilot and its contributors are not liable for third-party hiring decisions, employer correspondence, or changes to external platform terms.',
    },
  ],
};
