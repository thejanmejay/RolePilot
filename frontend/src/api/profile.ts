import { apiClient } from './client';
import type {
  BulkSkillsCreate,
  Experience,
  ExperienceCreate,
  Profile,
  ProfileUpdate,
  Skill,
  SkillCreate,
} from '../types/profile';

export const profileApi = {
  /** Retrieve authenticated user's profile with skills and experiences */
  getProfile: () => apiClient.get<Profile>('/api/v1/profile'),

  /** Complete initial candidate profile onboarding */
  completeOnboarding: (data: import('../types/profile').OnboardingData) =>
    apiClient.post<Profile>('/api/v1/profile/onboarding', data),

  /** Update profile fields */
  updateProfile: (data: ProfileUpdate) =>
    apiClient.patch<Profile>('/api/v1/profile', data),

  /** Add or update a single skill */
  addSkill: (skill: SkillCreate) =>
    apiClient.post<Skill>('/api/v1/profile/skills', skill),

  /** Add or update multiple skills in bulk */
  addSkillsBulk: (skills: SkillCreate[]) =>
    apiClient.post<Skill[]>('/api/v1/profile/skills/bulk', { skills } as BulkSkillsCreate),

  /** Delete a skill */
  deleteSkill: (skillId: string) =>
    apiClient.delete<void>(`/api/v1/profile/skills/${skillId}`),

  /** Add a work experience */
  addExperience: (exp: ExperienceCreate) =>
    apiClient.post<Experience>('/api/v1/profile/experiences', exp),

  /** Update an existing work experience */
  updateExperience: (expId: string, exp: ExperienceCreate) =>
    apiClient.put<Experience>(`/api/v1/profile/experiences/${expId}`, exp),

  /** Delete a work experience */
  deleteExperience: (expId: string) =>
    apiClient.delete<void>(`/api/v1/profile/experiences/${expId}`),

  /** Finalize structured onboarding enforcing all 4 required sections */
  finalizeOnboarding: () =>
    apiClient.post<Profile>('/api/v1/profile/onboarding/finalize', {}),

  /** Add an education record */
  addEducation: (edu: import('../types/profile').EducationCreate) =>
    apiClient.post<import('../types/profile').Education>('/api/v1/profile/educations', edu),

  /** Delete an education record */
  deleteEducation: (eduId: string) =>
    apiClient.delete<void>(`/api/v1/profile/educations/${eduId}`),

  /** List uploaded candidate resumes */
  getResumes: () => apiClient.get<import('../types/profile').Resume[]>('/api/v1/resumes'),

  /** Upload a PDF resume */
  uploadResume: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post<import('../types/profile').Resume>('/api/v1/resumes/upload', formData);
  },

  /** Delete a resume */
  deleteResume: (resumeId: string) =>
    apiClient.delete<void>(`/api/v1/resumes/${resumeId}`),
};

