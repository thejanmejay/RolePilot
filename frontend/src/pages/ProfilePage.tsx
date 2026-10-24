import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';
import type { Profile, Resume } from '../types/profile';
import type { SearchConfig } from '../types/job';
import { profileApi } from '../api/profile';
import { jobsApi } from '../api/jobs';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatErrorMessage } from '../api/client';
import { calculateApplicationReadiness } from '../utils/readiness';

import { ProfileReadinessHeader } from '../components/profile/ProfileReadinessHeader';
import { ContactInfoSection } from '../components/profile/ContactInfoSection';
import { ExperienceSection } from '../components/profile/ExperienceSection';
import { SkillsSection } from '../components/profile/SkillsSection';
import { ResumeSection } from '../components/profile/ResumeSection';
import { ApplicationPreferencesSection } from '../components/profile/ApplicationPreferencesSection';
import { SearchCriteriaSection } from '../components/profile/SearchCriteriaSection';
import { EducationSection } from '../components/profile/EducationSection';
import { ProfileHeaderSkeleton, SectionSkeleton } from '../components/Skeleton';
import { AuthModal } from '../components/AuthModal';

interface ProfilePageProps {
  onNavigateTab?: (tab: 'dashboard' | 'profile' | 'jobs' | 'applications' | 'automation') => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onNavigateTab }) => {
  const { isAuthenticated } = useAuth();
  const { showError } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [searchConfigs, setSearchConfigs] = useState<SearchConfig[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllData = useCallback(async (refreshOnly = false) => {
    if (!refreshOnly) setIsLoading(true);
    else setIsRefreshing(true);
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
      const msg = formatErrorMessage(err);
      setError(msg);
      showError(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showError]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAllData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated, fetchAllData]);

  const handleProfileUpdated = (updated: Profile) => {
    setProfile(updated);
  };

  const handleDataChanged = () => {
    fetchAllData(true);
  };

  const handleTotalExperienceUpdated = async (years: number, months: number) => {
    try {
      const updated = await profileApi.updateProfile({
        experience_years: years,
        experience_months: months,
      });
      setProfile(updated);
    } catch (err) {
      showError(formatErrorMessage(err));
      throw err;
    }
  };

  // Single canonical readiness calculation
  const readiness = useMemo(() => {
    return calculateApplicationReadiness(profile, resumes, searchConfigs);
  }, [profile, resumes, searchConfigs]);

  const handleNavigateToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="main-content">
        <AuthModal isOpen={true} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="main-content">
        <ProfileHeaderSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
        <SectionSkeleton />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="main-content">
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <AlertCircle size={48} color="var(--danger)" style={{ margin: '0 auto 16px auto' }} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>
            Failed to load automation profile
          </h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px', maxWidth: '480px', margin: '0 auto 20px auto' }}>
            {error}
          </p>
          <button onClick={() => fetchAllData()} className="btn btn-primary" style={{ margin: '0 auto' }}>
            <RefreshCw size={16} />
            <span>Retry</span>
          </button>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="main-content" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Top Bar: Sync status indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Profile & Automation Readiness
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Source-of-truth configuration layer for RolePilot automated application submissions.
          </p>
        </div>

        <button
          onClick={() => fetchAllData(true)}
          disabled={isRefreshing}
          className="btn btn-secondary"
          style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          title="Refresh profile and readiness state from backend"
        >
          <RefreshCw size={13} className={isRefreshing ? 'spin' : ''} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh State'}</span>
        </button>
      </div>

      {/* 1. Profile Overview / Readiness Header */}
      <ProfileReadinessHeader
        readiness={readiness}
        onNavigateToSection={handleNavigateToSection}
        onNavigateTab={(tab) => onNavigateTab?.(tab)}
      />

      {/* 2. Contact & Basic Information */}
      <ContactInfoSection
        profile={profile}
        onProfileUpdated={handleProfileUpdated}
      />

      {/* 3. Experience */}
      <ExperienceSection
        experiences={profile.experiences || []}
        experienceYears={profile.experience_years}
        experienceMonths={profile.experience_months}
        onExperiencesChanged={handleDataChanged}
        onTotalExperienceUpdated={handleTotalExperienceUpdated}
      />

      {/* 4. Skills */}
      <SkillsSection
        skills={profile.skills || []}
        onSkillsChanged={handleDataChanged}
      />

      {/* 5. Resume Management */}
      <ResumeSection
        resumes={resumes}
        onResumesChanged={handleDataChanged}
      />

      {/* 6. Application Preferences */}
      <ApplicationPreferencesSection
        profile={profile}
        onProfileUpdated={handleProfileUpdated}
      />

      {/* 7. Search Criteria */}
      <SearchCriteriaSection
        searchConfigs={searchConfigs}
        onSearchConfigChanged={handleDataChanged}
        onNavigateTab={(tab) => onNavigateTab?.(tab)}
      />

      {/* 8. Education Section */}
      <EducationSection />
    </div>
  );
};
