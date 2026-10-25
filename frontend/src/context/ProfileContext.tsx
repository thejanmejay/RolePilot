import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Profile, Resume } from '../types/profile';
import type { SearchConfig } from '../types/job';
import { profileApi } from '../api/profile';
import { jobsApi } from '../api/jobs';
import { useAuth } from './AuthContext';
import { usePolicy } from './PolicyContext';
import { formatErrorMessage } from '../api/client';
import { calculateApplicationReadiness, type ApplicationReadiness } from '../utils/readiness';

interface ProfileContextType {
  profile: Profile | null;
  resumes: Resume[];
  searchConfigs: SearchConfig[];
  readiness: ApplicationReadiness;
  isLoading: boolean;
  isRefreshing: boolean;
  isOnboardingCompleted: boolean;
  error: string | null;
  refreshProfile: (silent?: boolean) => Promise<void>;
  completeOnboarding: (data: import('../types/profile').OnboardingData) => Promise<Profile>;
  updateProfileState: (updated: Partial<Profile> | Profile) => void;
  setResumes: React.Dispatch<React.SetStateAction<Resume[]>>;
  setSearchConfigs: React.Dispatch<React.SetStateAction<SearchConfig[]>>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { hasAcceptedPolicy } = usePolicy();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [searchConfigs, setSearchConfigs] = useState<SearchConfig[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(
    async (silent = false) => {
      // These APIs are guarded by the backend until the active policy is accepted.
      // Wait for the status check so initial session restoration does not issue
      // requests that are expected to fail with 403.
      if (!isAuthenticated || hasAcceptedPolicy !== true) {
        if (!isAuthenticated || hasAcceptedPolicy === false) {
          setProfile(null);
          setResumes([]);
          setSearchConfigs([]);
        }
        setIsLoading(false);
        return;
      }

      if (!silent) {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const [profileData, resumesData, searchConfigsData] = await Promise.all([
          profileApi.getProfile(),
          profileApi.getResumes().catch(() => [] as Resume[]),
          jobsApi.getSearchConfigs().catch(() => [] as SearchConfig[]),
        ]);

        setProfile(profileData);
        setResumes(resumesData);
        setSearchConfigs(searchConfigsData);
      } catch (err) {
        console.error('Failed to load candidate profile:', err);
        setError(formatErrorMessage(err));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [isAuthenticated, hasAcceptedPolicy]
  );

  useEffect(() => {
    if (isAuthenticated && hasAcceptedPolicy === true) {
      refreshProfile(false);
    } else {
      if (!isAuthenticated || hasAcceptedPolicy === false) {
        setProfile(null);
        setResumes([]);
        setSearchConfigs([]);
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
    }
  }, [isAuthenticated, hasAcceptedPolicy, refreshProfile]);

  useEffect(() => {
    const handleAuthCleanup = () => {
      setProfile(null);
      setResumes([]);
      setSearchConfigs([]);
      setError(null);
      setIsLoading(false);
      setIsRefreshing(false);
    };

    window.addEventListener('auth:logout', handleAuthCleanup);
    window.addEventListener('auth:cleared', handleAuthCleanup);
    return () => {
      window.removeEventListener('auth:logout', handleAuthCleanup);
      window.removeEventListener('auth:cleared', handleAuthCleanup);
    };
  }, []);

  const updateProfileState = useCallback((updated: Partial<Profile> | Profile) => {
    setProfile((prev) => (prev ? { ...prev, ...updated } : (updated as Profile)));
  }, []);

  const completeOnboarding = useCallback(
    async (data: import('../types/profile').OnboardingData): Promise<Profile> => {
      const updatedProfile = await profileApi.completeOnboarding(data);
      setProfile(updatedProfile);
      // Silently refresh searchConfigs in case a default search config was initialized
      jobsApi.getSearchConfigs().then(setSearchConfigs).catch(() => {});
      return updatedProfile;
    },
    []
  );

  const isOnboardingCompleted = useMemo(() => {
    return Boolean(profile?.onboarding_completed);
  }, [profile?.onboarding_completed]);

  const readiness = useMemo(() => {
    return calculateApplicationReadiness(profile, resumes, searchConfigs);
  }, [profile, resumes, searchConfigs]);

  const value = useMemo(
    () => ({
      profile,
      resumes,
      searchConfigs,
      readiness,
      isLoading,
      isRefreshing,
      isOnboardingCompleted,
      error,
      refreshProfile,
      completeOnboarding,
      updateProfileState,
      setResumes,
      setSearchConfigs,
    }),
    [
      profile,
      resumes,
      searchConfigs,
      readiness,
      isLoading,
      isRefreshing,
      isOnboardingCompleted,
      error,
      refreshProfile,
      completeOnboarding,
      updateProfileState,
    ]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useProfile = (): ProfileContextType => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
