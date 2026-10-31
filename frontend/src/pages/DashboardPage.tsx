import React, { useEffect, useState, useRef } from 'react';
import {
  Search,
  Eye,
  ShieldCheck,
  Send,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { useToast } from '../context/ToastContext';
import { formatErrorMessage, getStructuredApiError } from '../api/client';
import { applicationsApi } from '../api/applications';
import { automationApi } from '../api/automation';
import { linkedinApi } from '../api/linkedin';
import type { AutomationRun } from '../types/automation';
import type { Application } from '../types/application';
import type { LinkedInStatus } from '../types/linkedin';
import { AlertTriangle } from 'lucide-react';

import { ActiveRunHUD } from '../components/dashboard/ActiveRunHUD';
import { DashboardMetricCard } from '../components/dashboard/DashboardMetricCard';
import { ProfileReadinessCard } from '../components/dashboard/ProfileReadinessCard';
import { ApplicationPipelineCard } from '../components/dashboard/ApplicationPipelineCard';
import { QuickActionsCard } from '../components/dashboard/QuickActionsCard';
import { RecentActivityTable } from '../components/dashboard/RecentActivityTable';
import { TodayAutomationRunCard } from '../components/dashboard/TodayAutomationRunCard';
import { LinkedInStatusCard } from '../components/linkedin/LinkedInStatusCard';
import { LinkedInConsentModal } from '../components/linkedin/LinkedInConsentModal';
import { ErrorState } from '../components/common';
import { ExtensionPromotion } from '../components/extension/ExtensionPromotion';
import { useNavigation } from '../context/NavigationContext';

interface DashboardPageProps {
  onNavigateTab: (tab: 'dashboard' | 'profile' | 'jobs' | 'applications' | 'automation') => void;
  onNavigateToRun?: (runId: string) => void;
  onNavigateToApplication?: (applicationId?: string) => void;
  isActive?: boolean;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateTab,
  onNavigateToRun,
  onNavigateToApplication,
  isActive = true,
}) => {
  const { isAuthenticated, email, user } = useAuth();
  const { navigate } = useNavigation();
  const { profile, resumes, searchConfigs, refreshProfile } = useProfile();
  const { showSuccess, showError } = useToast();
  const prevActiveRef = useRef<boolean>(isActive);

  const [isLoading, setIsLoading] = useState(true);
  const [isTriggering, setIsTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [applications, setApplications] = useState<Application[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [linkedInStatus, setLinkedInStatus] = useState<LinkedInStatus | null>(null);
  const [isLinkedInConsentOpen, setIsLinkedInConsentOpen] = useState<boolean>(false);
  const [statusRefreshKey, setStatusRefreshKey] = useState<number>(0);

  const fetchDashboardData = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    setError(null);

    try {
      const [appsData, runsData, statusData] = await Promise.all([
        applicationsApi.getApplications().catch(() => []),
        automationApi.getRuns().catch(() => []),
        linkedinApi.getStatus().catch(() => null),
        refreshProfile(true),
      ]);

      setApplications(appsData);
      setRuns(runsData);
      if (statusData) setLinkedInStatus(statusData);
    } catch (err) {
      if (!isBackground) {
        setError(formatErrorMessage(err));
      }
    } finally {
      if (!isBackground) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isActive && !prevActiveRef.current && isAuthenticated) {
      fetchDashboardData(true);
    }
    prevActiveRef.current = isActive;
  }, [isActive, isAuthenticated]);

  // Find active or queued run
  const activeRun = runs.find((r) => r.status === 'running' || r.status === 'queued') || null;

  // Real KPI calculations from persisted API data
  const totalApplications = applications.length;
  const liveSubmitted = applications.filter(
    (a) => a.status === 'applied' || a.status === 'submitted'
  ).length;
  const dryRunCompleted = applications.filter(
    (a) => a.status === 'dry_run_completed' || a.status === 'verified'
  ).length;

  const totalJobsFound = runs.reduce((acc, r) => acc + (r.jobs_found || 0), 0);
  const totalJobsProcessed = runs.reduce((acc, r) => acc + (r.jobs_processed || 0), 0);

  // If newly signed up candidate has 0 runs, display 0 or the real discovered jobs count
  const displayJobsDiscovered = totalJobsFound > 0 ? totalJobsFound : totalApplications;
  const displayFormsEvaluated = totalJobsProcessed > 0 ? totalJobsProcessed : dryRunCompleted + liveSubmitted;

  const activeSearchConfig = searchConfigs.find((c) => c.is_active) || searchConfigs[0] || null;

  const isLinkedInExpiredOrDisconnected = Boolean(
    linkedInStatus &&
    (!linkedInStatus.is_connected ||
      linkedInStatus.status === 'expired' ||
      linkedInStatus.status === 'error' ||
      !linkedInStatus.has_consent)
  );

  const candidateName = profile?.first_name
    ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ''}`
    : email
    ? email.split('@')[0]
    : 'Janmejay Singh';

  // Formatted date string matching visual reference e.g. "Wed, Oct 28, 2026 · 2:20 AM"
  const formattedDateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date()).replace(/, ([0-9]{4})/, ' $1 ·');

  const handleLaunchSafeDryRun = async () => {
    setIsTriggering(true);
    try {
      // Safety Gate: LinkedIn connection & consent check
      const statusData = await linkedinApi.getStatus().catch(() => null);
      if (!statusData?.is_connected || !statusData?.has_consent || statusData?.status === 'expired') {
        setIsLinkedInConsentOpen(true);
        setIsTriggering(false);
        return;
      }

      await automationApi.createRun({
        search_config_id: activeSearchConfig?.id,
        dry_run: true,
        max_jobs: 5,
      });

      showSuccess('Safe Dry-Run automation triggered successfully (5 jobs, no live submission).');
      fetchDashboardData(true);
      setStatusRefreshKey((k) => k + 1);
      onNavigateTab('automation');
    } catch (err) {
      const struct = getStructuredApiError(err);
      const isExpired =
        struct?.errorCode === 'LINKEDIN_SESSION_EXPIRED' ||
        struct?.errorCode === 'LINKEDIN_SESSION_INVALID' ||
        struct?.errorCode === 'LINKEDIN_SESSION_MISSING' ||
        formatErrorMessage(err).toLowerCase().includes('session');
      if (isExpired) {
        showError(struct?.message || 'LinkedIn session expired. Please reconnect your LinkedIn account to continue.');
        setIsLinkedInConsentOpen(true);
      } else {
        showError(struct?.message || formatErrorMessage(err));
      }
    } finally {
      setIsTriggering(false);
    }
  };

  return (
    <div className="dashboard-content" style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Top Header Row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.65rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Welcome back, {candidateName} 👋
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
            Let's keep your job search on track. Here's what's happening with your applications and automation.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: '#64748B', fontWeight: 600 }}>
            {formattedDateStr}
          </span>
          <button
            type="button"
            onClick={() => fetchDashboardData()}
            disabled={isLoading}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.84rem',
              padding: '7px 16px',
              minHeight: '36px',
              borderRadius: '8px',
              background: '#FFFFFF',
              borderColor: 'var(--border)',
              color: 'var(--text-main)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => fetchDashboardData()} />}

      {/* LinkedIn Session-Expired Blocker Banner */}
      {isLinkedInExpiredOrDisconnected && (
        <div
          role="alert"
          style={{
            padding: '16px 20px',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)',
            color: '#92400E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={22} color="#D97706" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                LinkedIn Session Expired or Disconnected
              </div>
              <div style={{ fontSize: '0.84rem', marginTop: '2px', color: '#78350F' }}>
                Automated job search, extraction, and dry-run testing require an active LinkedIn connection. Reconnect your session to resume.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setIsLinkedInConsentOpen(true)}
              className="btn btn-primary btn-sm"
              style={{ minHeight: '36px' }}
            >
              <RefreshCw size={14} />
              <span>Reconnect LinkedIn</span>
            </button>
          </div>
        </div>
      )}

      <ExtensionPromotion
        key={user?.id || profile?.id || 'profile-loading'}
        placement="dashboard"
        isAuthenticated={isAuthenticated}
        onboardingComplete={Boolean(profile?.onboarding_completed)}
        accountId={user?.id || profile?.id}
        onContinueOnboarding={() => navigate('/onboarding')}
      />

      {/* Active Run HUD (when run is running/queued) */}
      <ActiveRunHUD
        activeRun={activeRun}
        onNavigateToRun={(runId) => {
          if (onNavigateToRun) {
            onNavigateToRun(runId);
          } else {
            onNavigateTab('automation');
          }
        }}
      />

      {/* 1. Four KPI Metric Cards */}
      <div className="stat-grid">
        <DashboardMetricCard
          title="Jobs Discovered"
          value={displayJobsDiscovered}
          icon={Search}
          iconColor="#0284C7"
          iconBg="#E0F2FE"
          trendLabel="All Records"
          isLoading={isLoading}
          onClick={() => onNavigateTab('jobs')}
        />
        <DashboardMetricCard
          title="Forms Evaluated"
          value={displayFormsEvaluated}
          icon={Eye}
          iconColor="#9333EA"
          iconBg="#F3E8FF"
          trendLabel="Simulated"
          isLoading={isLoading}
          onClick={() => onNavigateTab('automation')}
        />
        <DashboardMetricCard
          title="Dry Runs Verified"
          value={dryRunCompleted}
          icon={ShieldCheck}
          iconColor="#1769C2"
          iconBg="#DBEAFE"
          trendLabel="Triple-Key"
          isLoading={isLoading}
          onClick={() => onNavigateTab('automation')}
        />
        <DashboardMetricCard
          title="Live Submissions"
          value={liveSubmitted}
          icon={Send}
          iconColor="#16A34A"
          iconBg="#DCFCE7"
          trendLabel="Completion"
          isLoading={isLoading}
          onClick={() => onNavigateTab('applications')}
        />
      </div>

      {/* 2. Middle Row: Profile Readiness (Left) | Application Pipeline (Center) | Quick Actions (Right) */}
      <div className="dashboard-middle-grid">
        <ProfileReadinessCard
          profile={profile}
          resumes={resumes}
          searchConfigs={searchConfigs}
          onNavigateProfile={() => onNavigateTab('profile')}
        />

        <ApplicationPipelineCard
          jobsDiscovered={displayJobsDiscovered}
          formsEvaluated={displayFormsEvaluated}
          dryRunsVerified={dryRunCompleted}
          liveSubmissions={liveSubmitted}
        />

        <QuickActionsCard
          onRunDryRun={handleLaunchSafeDryRun}
          onNavigateJobs={() => onNavigateTab('jobs')}
          onNavigateApplications={() => onNavigateTab('applications')}
          onNavigateAutomation={() => onNavigateTab('automation')}
          onRequireLinkedInConsent={() => setIsLinkedInConsentOpen(true)}
          isTriggering={isTriggering}
        />
      </div>

      {/* 3. Bottom Row: Recent Activity & Applications (Left ~65%) | LinkedIn Integration & Today's Run (Right ~35%) */}
      <div className="dashboard-bottom-grid">
        {/* Left Column: Recent Activity Table */}
        <div>
          <RecentActivityTable
            applications={applications}
            onNavigateApplications={() => onNavigateTab('applications')}
            onNavigateApplication={onNavigateToApplication}
          />
        </div>

        {/* Right Column: Stacked LinkedIn Integration + Today's Automation Run */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <LinkedInStatusCard
            onOpenConnectModal={() => setIsLinkedInConsentOpen(true)}
            statusRefreshKey={statusRefreshKey}
          />

          <TodayAutomationRunCard
            activeSearchConfig={activeSearchConfig}
            onLaunchDryRun={handleLaunchSafeDryRun}
            isTriggering={isTriggering}
          />
        </div>
      </div>

      {/* LinkedIn Consent Modal */}
      <LinkedInConsentModal
        isOpen={isLinkedInConsentOpen}
        onClose={() => setIsLinkedInConsentOpen(false)}
        onConsentSuccess={() => {
          setIsLinkedInConsentOpen(false);
          setStatusRefreshKey((k) => k + 1);
          fetchDashboardData(true);
        }}
        onCancel={() => {
          setIsLinkedInConsentOpen(false);
        }}
      />
    </div>
  );
};
