import type { Skill } from '../types/profile';
import type { Job, MatchAnalysis } from '../types/job';

/**
 * Calculates candidate match score and analyzes matched/missing skills
 * by comparing candidate profile skills against the job title and description.
 */
export function calculateJobMatch(job: Job, candidateSkills: Skill[] = []): MatchAnalysis {
  if (!candidateSkills || candidateSkills.length === 0) {
    return {
      matchScore: 0,
      matchedSkills: [],
      missingSkills: [],
      experienceMatch: true,
      locationMatch: true,
    };
  }

  const jobText = `${job.title || ''} ${job.description || ''}`.toLowerCase();
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  candidateSkills.forEach((skill) => {
    const skillNameLower = (skill.name || '').trim().toLowerCase();
    if (!skillNameLower) return;

    // Word boundary or containment check
    const regex = new RegExp(`\\b${escapeRegExp(skillNameLower)}\\b`, 'i');
    if (regex.test(jobText) || jobText.includes(skillNameLower)) {
      matchedSkills.push(skill.name);
    } else {
      missingSkills.push(skill.name);
    }
  });

  // Calculate percentage: matched skills / candidate total skills
  const matchRatio = candidateSkills.length > 0 ? matchedSkills.length / candidateSkills.length : 0;
  const matchScore = Math.min(100, Math.round(matchRatio * 100));

  return {
    matchScore,
    matchedSkills,
    missingSkills,
    experienceMatch: true,
    locationMatch: true,
  };
}

function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
