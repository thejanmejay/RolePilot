import type { Profile, Resume, Skill } from '../types/profile';
import type { SearchConfig } from '../types/job';

export interface ReadinessItem {
  id: string;
  label: string;
  description: string;
  isComplete: boolean;
  isBlocker: boolean;
  category: 'contact' | 'resume' | 'experience' | 'skills' | 'preferences' | 'search';
  targetSectionId: string;
}

export interface ApplicationReadiness {
  score: number;
  level: 'Ready' | 'Almost Ready' | 'Needs Attention';
  ready: boolean;
  completed: number;
  total: number;
  items: ReadinessItem[];
  blockers: string[];
  warnings: string[];
  summaryText: string;
}

/**
 * Single source-of-truth Application Readiness Engine.
 * Consumed by Dashboard, Profile, and Automation Controls.
 *
 * Distinguishes critical BLOCKERS (missing mandatory automation fields)
 * from non-blocking WARNINGS (profile enhancements).
 */
export function calculateApplicationReadiness(
  profile: Profile | null,
  resumes: Resume[] = [],
  searchConfigs: SearchConfig[] = []
): ApplicationReadiness {
  const skills: Skill[] = profile?.skills || [];
  const experiences = profile?.experiences || [];

  // 1. Contact: Name, Email, Phone, Location
  const hasName = Boolean(profile?.first_name?.trim());
  const hasPhone = Boolean(profile?.phone?.trim());
  const hasEmail = Boolean(profile?.email?.trim());
  const hasLocation = Boolean(profile?.city?.trim() || profile?.country?.trim());
  const contactComplete = hasName && hasPhone && hasEmail && hasLocation;

  // 2. Active Resume
  const hasActiveResume = resumes.some((r) => r.is_active) || resumes.length > 0;

  // 3. Experience: Total experience configured
  const hasTotalExperience = profile?.experience_years != null && profile.experience_years >= 0;

  // 4. Work History: At least 1 experience item
  const hasWorkHistory = experiences.length > 0;

  // 5. Skills: At least 1 core skill (recommended >= 3)
  const hasCoreSkills = skills.length >= 1;
  const hasRecommendedSkills = skills.length >= 3;

  // 6. Notice Period
  const hasNoticePeriod =
    profile?.notice_period_days != null &&
    profile.notice_period_days !== undefined &&
    profile.notice_period_days >= 0;

  // 7. Work Authorization
  const hasWorkAuth = profile?.authorized_to_work != null && profile.authorized_to_work !== undefined;

  // 8. Expected CTC
  const hasExpectedCtc =
    profile?.expected_ctc != null &&
    profile.expected_ctc !== undefined &&
    Number(profile.expected_ctc) > 0;

  // 9. Current CTC (Warning if missing)
  const hasCurrentCtc =
    profile?.current_ctc != null &&
    profile.current_ctc !== undefined &&
    Number(profile.current_ctc) > 0;

  // 10. Relocation preference (Warning if missing)
  const hasRelocationPref = profile?.willing_to_relocate != null && profile.willing_to_relocate !== undefined;

  // 11. Search Configuration (Blocker)
  const hasSearchConfig = searchConfigs.some((c) => c.is_active) || searchConfigs.length > 0;

  // 12. Online Portfolio / LinkedIn / GitHub (Warning)
  const hasWebLinks = Boolean(
    profile?.linkedin_url?.trim() ||
    profile?.github_url?.trim() ||
    profile?.website_url?.trim()
  );

  const items: ReadinessItem[] = [
    {
      id: 'contact_info',
      label: 'Contact Information',
      description: 'First name, email, phone number, and city/country',
      isComplete: contactComplete,
      isBlocker: true,
      category: 'contact',
      targetSectionId: 'contact-info-section',
    },
    {
      id: 'active_resume',
      label: 'Active PDF Resume',
      description: 'Uploaded primary resume for automated application attachments',
      isComplete: hasActiveResume,
      isBlocker: true,
      category: 'resume',
      targetSectionId: 'resume-section',
    },
    {
      id: 'core_skills',
      label: 'Core Technical Skills',
      description: 'At least 3 verified technical skills with years of experience',
      isComplete: hasRecommendedSkills,
      isBlocker: !hasCoreSkills, // Blocker if 0 skills, warning if 1-2 skills
      category: 'skills',
      targetSectionId: 'skills-section',
    },
    {
      id: 'experience_history',
      label: 'Work Experience History',
      description: 'Total experience years and past company roles recorded',
      isComplete: hasTotalExperience && hasWorkHistory,
      isBlocker: true,
      category: 'experience',
      targetSectionId: 'experience-section',
    },
    {
      id: 'notice_period',
      label: 'Notice Period',
      description: 'Official notice period in days for Easy Apply questions',
      isComplete: hasNoticePeriod,
      isBlocker: true,
      category: 'preferences',
      targetSectionId: 'application-preferences-section',
    },
    {
      id: 'work_authorization',
      label: 'Work Authorization',
      description: 'Confirmation of legal authorization to work',
      isComplete: hasWorkAuth,
      isBlocker: true,
      category: 'preferences',
      targetSectionId: 'application-preferences-section',
    },
    {
      id: 'expected_ctc',
      label: 'Expected Compensation (CTC)',
      description: 'Target annual salary for compensation screening questions',
      isComplete: hasExpectedCtc,
      isBlocker: true,
      category: 'preferences',
      targetSectionId: 'application-preferences-section',
    },
    {
      id: 'search_config',
      label: 'Active Search Criteria',
      description: 'Target job titles, locations, and Easy Apply search criteria',
      isComplete: hasSearchConfig,
      isBlocker: true,
      category: 'search',
      targetSectionId: 'search-criteria-section',
    },
    {
      id: 'current_ctc',
      label: 'Current Compensation (CTC)',
      description: 'Current annual compensation for salary history questions',
      isComplete: hasCurrentCtc,
      isBlocker: false,
      category: 'preferences',
      targetSectionId: 'application-preferences-section',
    },
    {
      id: 'willing_to_relocate',
      label: 'Relocation Preference',
      description: 'Confirmation whether willing to relocate for hybrid/on-site roles',
      isComplete: hasRelocationPref,
      isBlocker: false,
      category: 'preferences',
      targetSectionId: 'application-preferences-section',
    },
    {
      id: 'professional_links',
      label: 'Online Profiles (LinkedIn / GitHub)',
      description: 'LinkedIn, GitHub, or portfolio website URLs',
      isComplete: hasWebLinks,
      isBlocker: false,
      category: 'contact',
      targetSectionId: 'contact-info-section',
    },
    {
      id: 'total_experience_meta',
      label: 'Experience Years Configured',
      description: 'Total cumulative years and months of domain experience',
      isComplete: hasTotalExperience,
      isBlocker: false,
      category: 'experience',
      targetSectionId: 'experience-section',
    },
  ];

  const completed = items.filter((item) => item.isComplete).length;
  const total = items.length;
  const score = Math.round((completed / total) * 100);

  const blockers: string[] = [];
  const warnings: string[] = [];

  items.forEach((item) => {
    if (!item.isComplete) {
      if (item.isBlocker) {
        blockers.push(`${item.label} missing`);
      } else {
        warnings.push(`${item.label} not configured`);
      }
    }
  });

  // Strict readiness logic:
  // Ready: 90-100% and 0 blockers
  // Almost Ready: 70-89% and 0 blockers, OR >= 70% with blockers
  // Needs Attention: < 70%
  let level: 'Ready' | 'Almost Ready' | 'Needs Attention';
  if (score >= 90 && blockers.length === 0) {
    level = 'Ready';
  } else if (score >= 70) {
    level = 'Almost Ready';
  } else {
    level = 'Needs Attention';
  }

  const ready = blockers.length === 0 && score >= 70;

  let summaryText = '';
  if (ready) {
    summaryText = 'Profile fully verified. Automation engine has all required parameters for Easy Apply submissions.';
  } else if (blockers.length > 0) {
    summaryText = `${blockers.length} critical blocker${blockers.length === 1 ? '' : 's'} prevent automation runs from answering form questions accurately.`;
  } else {
    summaryText = 'Profile almost ready. Configure optional fields for maximum job qualification match scores.';
  }

  return {
    score,
    level,
    ready,
    completed,
    total,
    items,
    blockers,
    warnings,
    summaryText,
  };
}
