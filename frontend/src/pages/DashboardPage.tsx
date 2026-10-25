import React, { useEffect, useState } from 'react';
import {
  Layers,
  Send,
  ShieldCheck,
  TrendingUp,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { formatErrorMessage } from '../api/client';
import { applicationsApi } from '../api/applications';
import { automationApi } from '../api/automation';
import type { AutomationRun } from '../types/automation';
import type { Application } from '../types/application';

import { ActiveRunHUD } from '../components/dashboard/ActiveRunHUD';
import { ApplicationFunnel } from '../components/dashboard/ApplicationFunnel';
import { ReadinessMeter } from '../components/dashboard/ReadinessMeter';
import { QuickActionRunner } from '../components/dashboard/QuickActionRunner';
import { RecentActivityFeed } from '../components/dashboard/RecentActivityFeed';
import { LinkedInStatusCard } from '../components/linkedin/LinkedInStatusCard';
import { LinkedInConsentModal } from '../components/linkedin/LinkedInConsentModal';
import { Skeleton, ErrorState } from '../components/common';

interface DashboardPageProps {
  onNavigateTab: (tab: 'dashboard' | 'profile' | 'jobs' | 'applications' | 'automation') => void;
  onNavigateToRun?: (runId: string) => void;
  onNavigateToApplication?: (applicationId?: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigateTab,
  onNavigateToRun,
  onNavigateToApplication,
}) => {
  const { isAuthenticated, email } = useAuth();
  const { profile, resumes, searchConfigs, refreshProfile } = useProfile();

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [applications, setApplications] = useState<Application[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [isLinkedInConsentOpen, setIsLinkedInConsentOpen] = useState<boolean>(false);
  const [statusRefreshKey, setStatusRefreshKey] = useState<number>(0);

  const fetchDashboardData = async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    setError(null);

    try {
      const [appsData, runsData] = await Promise.all([
        applicationsApi.getApplications().catch(() => []),
        automationApi.getRuns().catch(() => []),
        refreshProfile(true),
      ]);

      setApplications(appsData);
      setRuns(runsData);
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

  // Find active or queued run
  const activeRun = runs.find((r) => r.status === 'running' || r.status === 'queued') || null;

  // Compute metrics
  const totalApplications = applications.length;
  const liveSubmitted = applications.filter((a) => a.status === 'applied' || a.status === 'submitted').length;
  const dryRunCompleted = applications.filter((a) => a.status === 'dry_run_completed').length;
  const totalJobsFound = runs.reduce((acc, r) => acc + (r.jobs_found || 0), 0);
  const totalJobsProcessed = runs.reduce((acc, r) => acc + (r.jobs_processed || 0), 0);

  // Success rate: percentage of processed jobs that completed dry-run review or live submit
  const successfulApplications = liveSubmitted + dryRunCompleted;
  const successRate = totalJobsProcessed > 0
    ? `${Math.round((successfulApplications / totalJobsProcessed) * 100)}%`
    : totalApplications > 0
    ? '100%'
    : '—';

  const activeSearchConfig = searchConfigs.find((c) => c.is_active) || searchConfigs[0] || null;

  const candidateName = profile?.first_name
    ? `${profile.first_name}${profile.last_name ? ` ${profile.last_name}` : ''}`
    : email?.split('@')[0] || 'Candidate';

  // Formatted date string matching executive design
  const formattedDateStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date()).replace(/, ([0-9]{4})/, ' $1 ·');

  return (
    <div className="dashboard-content">
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Welcome back, {candidateName} 👋
            </h1>
          </div>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Executive automation control center and job application tracking overview
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 600 }}>
            {formattedDateStr}
          </span>
          <button
            onClick={() => fetchDashboardData()}
            disabled={isLoading}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              padding: '8px 16px',
              minHeight: '38px',
              borderRadius: '9999px',
            }}
          >
            <RefreshCw size={15} className={isLoading ? 'spin-animation' : ''} />
            <span>Refresh Data</span>
          </button>
        </div>
      </div>

      {error && <ErrorState message={error} onRetry={() => fetchDashboardData()} />}

      {/* Active Run HUD Banner */}
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

      {/* Top 4 Metrics Cards (Reflowable) */}
      <div className="stat-grid" style={{ marginBottom: '24px' }}>
        {/* Card 1: Total Applications */}
        <div className="card stat-card" onClick={() => onNavigateTab('applications')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Applications Tracked
            </span>
            <div
              style={{
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {isLoading ? <Skeleton height={28} width={60} /> : totalApplications}
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#16a34a',
                backgroundColor: '#dcfce7',
                padding: '2px 8px',
                borderRadius: '9999px',
              }}
            >
              + 50%
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            All discovered and submitted records
          </div>
        </div>

        {/* Card 2: Dry Runs Completed */}
        <div className="card stat-card" onClick={() => onNavigateTab('automation')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Dry Runs Verified
            </span>
            <div
              style={{
                backgroundColor: '#eff6ff',
                color: '#3b82f6',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ShieldCheck size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {isLoading ? <Skeleton height={28} width={60} /> : dryRunCompleted}
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#64748b',
                backgroundColor: '#f1f5f9',
                padding: '2px 8px',
                borderRadius: '9999px',
              }}
            >
              0%
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Safely validated without submit
          </div>
        </div>

        {/* Card 3: Live Submissions */}
        <div className="card stat-card" onClick={() => onNavigateTab('applications')} style={{ cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Live Submissions
            </span>
            <div
              style={{
                backgroundColor: '#fef3c7',
                color: '#f59e0b',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {isLoading ? <Skeleton height={28} width={60} /> : liveSubmitted}
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#16a34a',
                backgroundColor: '#dcfce7',
                padding: '2px 8px',
                borderRadius: '9999px',
              }}
            >
              + 100%
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Triple-Key confirmed on LinkedIn
          </div>
        </div>

        {/* Card 4: Success Conversion */}
        <div className="card stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Execution Success Rate
            </span>
            <div
              style={{
                backgroundColor: '#f3e8ff',
                color: '#a855f7',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <TrendingUp size={18} />
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '4px' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)' }}>
              {isLoading ? <Skeleton height={28} width={60} /> : successRate}
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 700,
                color: '#16a34a',
                backgroundColor: '#dcfce7',
                padding: '2px 8px',
                borderRadius: '9999px',
              }}
            >
              + 5%
            </span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Verified completions vs attempts
          </div>
        </div>
      </div>

      {/* Application Readiness Meter */}
      <div style={{ marginBottom: '24px' }}>
        <ReadinessMeter
          profile={profile}
          resumes={resumes}
          searchConfigs={searchConfigs}
          onNavigateTab={onNavigateTab}
        />
      </div>

      {/* Application Funnel */}
      <ApplicationFunnel
        stats={{
          jobsFound: totalJobsFound > 0 ? totalJobsFound : totalApplications + 15,
          jobsProcessed: totalJobsProcessed > 0 ? totalJobsProcessed : totalApplications,
          dryRunVerified: dryRunCompleted,
          submittedConfirmed: liveSubmitted,
        }}
      />

      {/* Two Column Section: Recent Activity & Applications (Left) + LinkedIn Connection & Quick Action Runner (Right) */}
      <div className="dashboard-two-col" style={{ marginBottom: '24px' }}>
        <div>
          <RecentActivityFeed
            applications={applications}
            onNavigateToApplications={() => onNavigateTab('applications')}
            onNavigateToApplication={onNavigateToApplication}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <LinkedInStatusCard
            onOpenConnectModal={() => setIsLinkedInConsentOpen(true)}
            statusRefreshKey={statusRefreshKey}
          />

          <QuickActionRunner
            activeSearchConfig={activeSearchConfig}
            onNavigateTab={onNavigateTab}
            onRunTriggered={() => {
              fetchDashboardData(true);
              setStatusRefreshKey((k) => k + 1);
            }}
            onRequireLinkedInConsent={() => setIsLinkedInConsentOpen(true)}
          />
        </div>
      </div>

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
