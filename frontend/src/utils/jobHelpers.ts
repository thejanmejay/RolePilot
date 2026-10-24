import type { Job } from '../types/job';
import type { Profile } from '../types/profile';

export interface QualificationAnalysis {
  matchScore: number;
  matchTier: {
    label: 'Strong Match' | 'Good Match' | 'Partial Match' | 'General Fit';
    color: string;
    bg: string;
    borderColor: string;
  };
  matchedSkills: string[];
  missingSkills: string[];
  titleMatch: boolean;
  locationMatch: boolean;
  isEasyApply: boolean;
  workMode: 'Remote' | 'Hybrid' | 'On-site' | 'Not specified';
  whyThisJobReasons: string[];
  potentialGaps: string[];
}

/**
 * Checks whether a job has LinkedIn Easy Apply available.
 */
export function isJobEasyApply(job: Job): boolean {
  if (!job) return false;
  if (job.raw_data) {
    if (job.raw_data.easy_apply === true || job.raw_data.easy_apply === 1) return true;
    if (job.raw_data.is_easy_apply === true || job.raw_data.is_easy_apply === 1) return true;
    if (job.raw_data.apply_method === 'easy_apply') return true;
  }
  const text = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  if (text.includes('easy apply') || text.includes('easyapply')) return true;
  return false;
}

/**
 * Extracts work arrangement (Remote, Hybrid, On-site).
 */
export function getJobWorkMode(job: Job): 'Remote' | 'Hybrid' | 'On-site' | 'Not specified' {
  if (!job) return 'Not specified';
  const text = `${job.location || ''} ${job.title || ''} ${job.employment_type || ''} ${job.description?.slice(0, 300) || ''}`.toLowerCase();
  if (text.includes('remote') || text.includes('work from home') || text.includes('wfh')) {
    return 'Remote';
  }
  if (text.includes('hybrid')) {
    return 'Hybrid';
  }
  if (text.includes('on-site') || text.includes('onsite') || text.includes('in-office')) {
    return 'On-site';
  }
  return 'Not specified';
}

/**
 * Formats salary range into clean readable text.
 */
export function formatSalary(min?: number | null, max?: number | null): string | null {
  if (!min && !max) return null;
  if (min && max) {
    const minL = (min / 100000).toFixed(1);
    const maxL = (max / 100000).toFixed(1);
    return `₹${minL}L – ₹${maxL}L`;
  }
  if (min) {
    return `₹${(min / 100000).toFixed(1)}L+`;
  }
  if (max) {
    return `Up to ₹${(max / 100000).toFixed(1)}L`;
  }
  return null;
}

import { formatRelativeDate } from './dates';

export const formatJobDate = formatRelativeDate;

/**
 * Escapes regex special characters.
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Comprehensive qualification analysis comparing candidate profile with job.
 */
export function analyzeJobQualification(job: Job, profile: Profile | null): QualificationAnalysis {
  const candidateSkills = profile?.skills || [];
  const jobTitle = (job.title || '').toLowerCase();
  const jobDesc = (job.description || '').toLowerCase();
  const jobLocation = (job.location || '').toLowerCase();
  const jobText = `${jobTitle} ${jobDesc}`;

  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  candidateSkills.forEach((skill) => {
    const sName = (skill.name || '').trim();
    if (!sName) return;
    const regex = new RegExp(`\\b${escapeRegExp(sName.toLowerCase())}\\b`, 'i');
    if (regex.test(jobText)) {
      matchedSkills.push(sName);
    } else {
      missingSkills.push(sName);
    }
  });

  const easyApply = isJobEasyApply(job);
  const workMode = getJobWorkMode(job);

  // Check title alignment
  const candidateTitles = [
    profile?.headline || '',
    ...(profile?.experiences || []).map((e) => e.job_title),
  ].filter(Boolean).join(' ').toLowerCase();
  const commonKeywords = ['qa', 'sdet', 'test', 'automation', 'engineer', 'developer', 'quality'];
  const titleMatchesKeywords = commonKeywords.filter((kw) => jobTitle.includes(kw) && candidateTitles.includes(kw));
  const titleMatch = titleMatchesKeywords.length > 0 || jobTitle.includes('qa') || jobTitle.includes('sdet');

  // Check location alignment
  const locationPref = [profile?.city, profile?.state, profile?.country].filter(Boolean).join(' ').toLowerCase();
  const locationMatch =
    workMode === 'Remote' ||
    (Boolean(locationPref) && (locationPref.includes(jobLocation) || jobLocation.includes(locationPref))) ||
    jobLocation.includes('india') ||
    jobLocation.includes('any');

  // Calculate composite match score
  let score = 0;
  if (candidateSkills.length > 0) {
    const skillRatio = matchedSkills.length / Math.min(candidateSkills.length, 6);
    score += Math.round(skillRatio * 60);
  } else {
    score += 40;
  }
  if (titleMatch) score += 20;
  if (locationMatch) score += 10;
  if (easyApply) score += 10;

  const clampedScore = Math.min(100, Math.max(0, score));

  // Match tier definition
  let matchTier: QualificationAnalysis['matchTier'];
  if (clampedScore >= 70) {
    matchTier = {
      label: 'Strong Match',
      color: '#15803d',
      bg: '#dcfce7',
      borderColor: '#bbf7d0',
    };
  } else if (clampedScore >= 45) {
    matchTier = {
      label: 'Good Match',
      color: '#0369a1',
      bg: '#e0f2fe',
      borderColor: '#bae6fd',
    };
  } else if (clampedScore >= 20) {
    matchTier = {
      label: 'Partial Match',
      color: '#b45309',
      bg: '#fef3c7',
      borderColor: '#fde68a',
    };
  } else {
    matchTier = {
      label: 'General Fit',
      color: '#64748b',
      bg: '#f1f5f9',
      borderColor: '#e2e8f0',
    };
  }

  // Why this job? concrete evidence
  const whyThisJobReasons: string[] = [];
  if (titleMatch) {
    whyThisJobReasons.push('Job title aligns with your target role and specialization.');
  }
  if (matchedSkills.length > 0) {
    whyThisJobReasons.push(`${matchedSkills.length} key profile skill${matchedSkills.length > 1 ? 's' : ''} matched in posting.`);
  }
  if (locationMatch) {
    whyThisJobReasons.push(
      workMode === 'Remote' ? 'Remote work arrangement supported.' : 'Location matches your target region.'
    );
  }
  if (easyApply) {
    whyThisJobReasons.push('LinkedIn Easy Apply enabled for autonomous multi-step fill.');
  }

  // Potential gaps
  const potentialGaps: string[] = [];
  if (!easyApply) {
    potentialGaps.push('External application site (Easy Apply not available for full auto-submission).');
  }
  if (matchedSkills.length === 0 && candidateSkills.length > 0) {
    potentialGaps.push('Primary profile skills not explicitly mentioned in vacancy text.');
  }
  if (missingSkills.length > 0) {
    const sampleMissing = missingSkills.slice(0, 3).join(', ');
    potentialGaps.push(`Profile skills not cited: ${sampleMissing}`);
  }

  return {
    matchScore: clampedScore,
    matchTier,
    matchedSkills,
    missingSkills,
    titleMatch,
    locationMatch,
    isEasyApply: easyApply,
    workMode,
    whyThisJobReasons,
    potentialGaps,
  };
}
