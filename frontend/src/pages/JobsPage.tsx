import React, { useEffect, useState, useMemo } from 'react';
import {
  Briefcase,
  SlidersHorizontal,
  RefreshCw,
  Compass,
} from 'lucide-react';
import { jobsApi } from '../api/jobs';
import { profileApi } from '../api/profile';
import { applicationsApi, type Application } from '../api/applications';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { formatErrorMessage } from '../api/client';
import { JobCard } from '../components/jobs/JobCard';
import { JobFilters, type FilterState } from '../components/jobs/JobFilters';
import { JobDetailsPanel } from '../components/jobs/JobDetailsPanel';
import { SearchConfigModal } from '../components/jobs/SearchConfigModal';
import { EmptyState, ErrorState, ListCardSkeleton } from '../components/common';
import {
  analyzeJobQualification,
  isJobEasyApply,
  getJobWorkMode,
} from '../utils/jobHelpers';
import type { Job } from '../types/job';
import type { Profile } from '../types/profile';

interface JobsPageProps {
  onNavigateToApplications?: (applicationId?: string) => void;
  onNavigateToRun?: (runId: string) => void;
}

const defaultFilters: FilterState = {
  searchTerm: '',
  locationTerm: '',
  companyTerm: '',
  applicationStatus: 'all',
  jobType: 'all',
  workMode: 'all',
  experienceLevel: 'all',
  easyApplyOnly: false,
  minSalary: null,
  datePosted: 'all',
  sortBy: 'match',
};

export const JobsPage: React.FC<JobsPageProps> = ({
  onNavigateToApplications,
  onNavigateToRun,
}) => {
  const { isAuthenticated } = useAuth();
  const { showError, showSuccess } = useToast();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [filters, setFilters] = useState<FilterState>(defaultFilters);

  // User tracked applications: jobId -> Application
  const [userApplications, setUserApplications] = useState<Map<string, Application>>(new Map());
  const [now] = useState(() => Date.now());

  // Search config modal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  // Fetch candidate profile, jobs, and saved applications
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [profileData, jobsData, appsData] = await Promise.all([
        profileApi.getProfile().catch(() => null),
        jobsApi.getJobs(),
        applicationsApi.getApplications().catch(() => [] as Application[]),
      ]);

      if (profileData) setProfile(profileData);
      setJobs(jobsData);

      const appMap = new Map<string, Application>();
      appsData.forEach((app) => appMap.set(app.job_id, app));
      setUserApplications(appMap);

      if (jobsData.length > 0) {
        setSelectedJob((prev) => {
          if (!prev) return jobsData[0];
          const found = jobsData.find((j) => j.id === prev.id);
          return found || jobsData[0];
        });
      } else {
        setSelectedJob(null);
      }
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleFilterChange = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
  };

  const handleToggleSave = async (jobId: string) => {
    const existingApp = userApplications.get(jobId);
    try {
      if (existingApp) {
        await applicationsApi.deleteApplication(existingApp.id);
        setUserApplications((prev) => {
          const next = new Map(prev);
          next.delete(jobId);
          return next;
        });
        showSuccess('Removed from saved shortlist.');
      } else {
        const createdApp = await applicationsApi.saveOrTrackApplication({
          job_id: jobId,
          status: 'saved',
        });
        setUserApplications((prev) => {
          const next = new Map(prev);
          next.set(jobId, createdApp);
          return next;
        });
        showSuccess('Job saved to your shortlist (persisted to database)!');
      }
    } catch (err) {
      showError(formatErrorMessage(err));
    }
  };

  // Comprehensive client-side filtering and sorting
  const filteredJobs = useMemo(() => {
    const filtered = jobs.filter((job) => {
      // Search term (title, company, keywords, description)
      if (filters.searchTerm.trim()) {
        const term = filters.searchTerm.toLowerCase();
        const text = `${job.title || ''} ${job.company || ''} ${job.description || ''}`.toLowerCase();
        if (!text.includes(term)) return false;
      }

      // Location term
      if (filters.locationTerm.trim()) {
        const loc = (job.location || '').toLowerCase();
        if (!loc.includes(filters.locationTerm.toLowerCase())) return false;
      }

      // Company term
      if (filters.companyTerm.trim()) {
        const comp = (job.company || '').toLowerCase();
        if (!comp.includes(filters.companyTerm.toLowerCase())) return false;
      }

      // Application status filter
      if (filters.applicationStatus !== 'all') {
        const app = userApplications.get(job.id);
        if (filters.applicationStatus === 'not_applied' && app) return false;
        if (filters.applicationStatus === 'saved' && app?.status !== 'saved') return false;
        if (filters.applicationStatus === 'applied') {
          const isApp = app?.status === 'applied' || app?.status === 'submitted';
          if (!isApp) return false;
        }
      }

      // Job type filter
      if (filters.jobType !== 'all') {
        const emp = (job.employment_type || '').toLowerCase();
        if (!emp.includes(filters.jobType.toLowerCase())) return false;
      }

      // Work mode filter
      if (filters.workMode !== 'all') {
        const mode = getJobWorkMode(job).toLowerCase();
        if (mode !== filters.workMode.toLowerCase()) return false;
      }

      // Experience level filter
      if (filters.experienceLevel !== 'all') {
        const exp = (job.experience_level || '').toLowerCase();
        if (!exp.includes(filters.experienceLevel.toLowerCase())) return false;
      }

      // Easy Apply only
      if (filters.easyApplyOnly && !isJobEasyApply(job)) {
        return false;
      }

      // Minimum salary
      if (filters.minSalary !== null) {
        const maxSal = job.salary_max || job.salary_min || 0;
        if (maxSal < filters.minSalary) return false;
      }

      // Date posted
      if (filters.datePosted !== 'all') {
        const dateStr = job.posted_at || job.created_at;
        if (dateStr) {
          const jobTime = new Date(dateStr).getTime();
          const diffHours = (now - jobTime) / (1000 * 60 * 60);
          if (filters.datePosted === 'today' && diffHours > 24) return false;
          if (filters.datePosted === 'past-week' && diffHours > 24 * 7) return false;
          if (filters.datePosted === 'past-month' && diffHours > 24 * 30) return false;
        }
      }

      return true;
    });

    // Sorting
    return filtered.sort((a, b) => {
      if (filters.sortBy === 'match') {
        const scoreA = analyzeJobQualification(a, profile).matchScore;
        const scoreB = analyzeJobQualification(b, profile).matchScore;
        return scoreB - scoreA;
      }
      if (filters.sortBy === 'date') {
        const timeA = new Date(a.posted_at || a.created_at).getTime();
        const timeB = new Date(b.posted_at || b.created_at).getTime();
        return timeB - timeA;
      }
      if (filters.sortBy === 'company') {
        return (a.company || '').localeCompare(b.company || '');
      }
      return 0;
    });
  }, [jobs, filters, userApplications, profile, now]);

  return (
    <div className="container" style={{ paddingBottom: '60px' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          margin: '24px 0 20px 0',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.6rem',
              fontWeight: 700,
              color: 'var(--text-main)',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Compass size={28} color="var(--primary)" />
            <span>Jobs Explorer & Qualification</span>
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Discover vacancies, analyze skill match evidence, evaluate Easy Apply compatibility, and queue dry testing.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsConfigModalOpen(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <SlidersHorizontal size={16} />
            <span>Search Configs</span>
          </button>

          <button
            onClick={fetchData}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Genuine Search & Filter Toolbar */}
      <JobFilters
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        totalCount={jobs.length}
        filteredCount={filteredJobs.length}
      />

      {/* Error alert with retry */}
      {error && <ErrorState message={error} onRetry={fetchData} />}

      {/* Responsive Split View (Desktop: 2 columns; Mobile: toggle list vs detail) */}
      <div className="jobs-page-grid">
        {/* Jobs list pane (Hidden on mobile if a job is actively selected) */}
        <div className={selectedJob ? 'desktop-only' : ''}>
          {isLoading ? (
            <ListCardSkeleton count={4} />
          ) : filteredJobs.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No jobs match your filter criteria"
              description="Try clearing filters or customize your search keywords in Search Configs."
              actionText="Clear Filters"
              onAction={handleResetFilters}
              secondaryActionText="Search Configs"
              onSecondaryAction={() => setIsConfigModalOpen(true)}
            />
          ) : (
            <div>
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  isSelected={selectedJob?.id === job.id}
                  onSelect={() => setSelectedJob(job)}
                  profile={profile}
                  application={userApplications.get(job.id) || null}
                  onToggleSave={() => handleToggleSave(job.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Job Details & Qualification Workspace */}
        <div style={{ position: 'sticky', top: '80px' }}>
          <JobDetailsPanel
            job={selectedJob}
            profile={profile}
            application={selectedJob ? userApplications.get(selectedJob.id) || null : null}
            onToggleSave={() => selectedJob && handleToggleSave(selectedJob.id)}
            onCloseMobile={() => setSelectedJob(null)}
            onNavigateToApplications={onNavigateToApplications}
            onNavigateToRun={onNavigateToRun}
          />
        </div>
      </div>

      {/* Search Config Modal */}
      <SearchConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        onConfigCreated={fetchData}
      />
    </div>
  );
};
