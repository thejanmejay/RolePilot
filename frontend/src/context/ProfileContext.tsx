import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Profile, Resume } from '../types/profile';
import type { SearchConfig } from '../types/job';
import { profileApi } from '../api/profile';
import { jobsApi } from '../api/jobs';
import { useAuth } from './AuthContext';
import { formatErrorMessage } from '../api/client';
import { calculateApplicationReadiness, type ApplicationReadiness } from '../utils/readiness';

interface ProfileContextType {
  profile: Profile | null;
  resumes: Resume[];
  searchConfigs: SearchConfig[];
  readiness: ApplicationReadiness;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  refreshProfile: (silent?: boolean) => Promise<void>;
  updateProfileState: (updated: Partial<Profile> | Profile) => void;
  setResumes: React.Dispatch<React.SetStateAction<Resume[]>>;
  setSearchConfigs: React.Dispatch<React.SetStateAction<SearchConfig[]>>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [searchConfigs, setSearchConfigs] = useState<SearchConfig[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(
    async (silent = false) => {
      if (!isAuthenticated) {
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
    [isAuthenticated]
  );

  useEffect(() => {
    if (isAuthenticated) {
      refreshProfile(false);
    } else {
      setProfile(null);
      setResumes([]);
      setSearchConfigs([]);
      setIsLoading(false);
    }
  }, [isAuthenticated, refreshProfile]);

  const updateProfileState = useCallback((updated: Partial<Profile> | Profile) => {
    setProfile((prev) => (prev ? { ...prev, ...updated } : (updated as Profile)));
  }, []);

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
      error,
      refreshProfile,
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
      error,
      refreshProfile,
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
