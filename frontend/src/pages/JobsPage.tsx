import React, { useEffect, useState, useMemo } from 'react';
import {
  Briefcase,
  SlidersHorizontal,
  RefreshCw,
  Compass,
  ListChecks,
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
import { RunQueueDrawer } from '../components/jobs/RunQueueDrawer';
import { ReviewAndRunModal } from '../components/jobs/ReviewAndRunModal';
import { EmptyState, ErrorState, ListCardSkeleton, Button } from '../components/common';
import {
  analyzeJobQualification,
  isJobEasyApply,
  getJobWorkMode,
} from '../utils/jobHelpers';
import type { Job } from '../types/job';
import type { Profile, Resume } from '../types/profile';
import type { AutomationRun } from '../types/automation';

interface JobsPageProps {
  onNavigateToApplications?: (applicationId?: string) => void;
  onNavigateToRun?: (runId: string) => void;
  isActive?: boolean;
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
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Run Queue state
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [isReviewModalOpen, setIsReviewModalOpen] = useState<boolean>(false);
  const [reviewMode, setReviewMode] = useState<'dry_run' | 'live'>('dry_run');
  const [reviewTargetJobs, setReviewTargetJobs] = useState<Job[]>([]);

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
      const [profileData, jobsData, appsData, resumesData] = await Promise.all([
        profileApi.getProfile().catch(() => null),
        jobsApi.getJobs(),
        applicationsApi.getApplications().catch(() => [] as Application[]),
        profileApi.getResumes().catch(() => [] as Resume[]),
      ]);

      if (profileData) setProfile(profileData);
      setJobs(jobsData);
      setResumes(resumesData);

      const appMap = new Map<string, Application>();
      appsData.forEach((app) => appMap.set(app.job_id, app));
      setUserApplications(appMap);

      if (jobsData.length > 0) {
        const isMobileScreen = typeof window !== 'undefined' && window.innerWidth <= 768;
        setSelectedJob((prev) => {
          if (prev) {
            const found = jobsData.find((j) => j.id === prev.id);
            return found || jobsData[0];
          }
          return isMobileScreen ? null : jobsData[0];
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

  const handleToggleSelectJob = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = (visibleJobs: Job[]) => {
    const visibleIds = visibleJobs.map((j) => j.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedJobIds.has(id));

    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleRemoveFromQueue = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      next.delete(jobId);
      return next;
    });
  };

  const handleClearQueue = () => {
    setSelectedJobIds(new Set());
    setIsQueueOpen(false);
  };

  const handleProceedToReview = (mode: 'dry_run' | 'live', targetJobs: Job[]) => {
    setReviewMode(mode);
    setReviewTargetJobs(targetJobs);
    setIsQueueOpen(false);
    setIsReviewModalOpen(true);
  };

  const handleRunStarted = (run: AutomationRun) => {
    if (run.allow_live_submission && !run.dry_run) {
      setSelectedJobIds((prev) => {
        const next = new Set(prev);
        reviewTargetJobs.forEach((j) => next.delete(j.id));
        return next;
      });
    } else {
      setSelectedJobIds(new Set());
    }
    setReviewTargetJobs([]);
    setIsReviewModalOpen(false);
    if (onNavigateToRun) {
      onNavigateToRun(run.id);
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
          {/* Bulk Selection and Queue Action Bar */}
          {!isLoading && filteredJobs.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 14px',
                backgroundColor: '#ffffff',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-light)',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '10px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={
                      filteredJobs.length > 0 &&
                      filteredJobs.every((j) => selectedJobIds.has(j.id))
                    }
                    onChange={() => handleToggleSelectAll(filteredJobs)}
                    style={{
                      width: '16px',
                      height: '16px',
                      accentColor: 'var(--primary)',
                      cursor: 'pointer',
                    }}
                  />
                  <span>Select All Visible ({filteredJobs.length})</span>
                </label>

                {selectedJobIds.size > 0 && (
                  <button
                    type="button"
                    onClick={handleClearQueue}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      textDecoration: 'underline',
                    }}
                  >
                    Clear selection
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  {selectedJobIds.size} queued
                </span>

                <Button
                  variant="primary"
                  size="sm"
                  disabled={selectedJobIds.size === 0}
                  onClick={() => setIsQueueOpen(true)}
                  leftIcon={<ListChecks size={14} />}
                >
                  Run Queue ({selectedJobIds.size})
                </Button>
              </div>
            </div>
          )}

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
                  isChecked={selectedJobIds.has(job.id)}
                  onToggleCheck={() => handleToggleSelectJob(job.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Job Details & Qualification Workspace */}
        <div className={!selectedJob ? 'desktop-only' : ''} style={{ position: 'sticky', top: '80px' }}>
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

      {/* Run Queue Drawer */}
      <RunQueueDrawer
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        queuedJobs={jobs.filter((j) => selectedJobIds.has(j.id))}
        onRemoveJob={handleRemoveFromQueue}
        onClearQueue={handleClearQueue}
        onProceedToReview={handleProceedToReview}
      />

      {/* Review & Run Modal */}
      <ReviewAndRunModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        queuedJobs={reviewTargetJobs}
        mode={reviewMode}
        profile={profile}
        resumes={resumes}
        onRunStarted={handleRunStarted}
      />

      {/* Sticky Floating Queue Pill (Mobile & Desktop) */}
      {selectedJobIds.size > 0 && !isQueueOpen && !isReviewModalOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 900,
            backgroundColor: 'var(--sidebar-bg)',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: 'var(--radius-full)',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600 }}>
            <span
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.78rem',
                fontWeight: 700,
              }}
            >
              {selectedJobIds.size}
            </span>
            <span>Jobs in Queue</span>
          </div>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsQueueOpen(true)}
            leftIcon={<ListChecks size={14} />}
            style={{ borderRadius: 'var(--radius-full)' }}
          >
            Open Queue
          </Button>
        </div>
      )}
    </div>
  );
};
