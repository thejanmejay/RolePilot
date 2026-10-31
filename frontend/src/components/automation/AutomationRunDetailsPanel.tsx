import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  ListOrdered,
  FileQuestion,
  Terminal,
  ArrowLeft,
  Search,
  FileCheck,
  Info,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import type { AutomationRun, AutomationLog } from '../../types/automation';
import type { Application } from '../../api/applications';
import { automationApi } from '../../api/automation';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';
import { formatDate, formatTime } from '../../utils/dates';
import { formatRunDuration, normalizeRunStatus } from '../../utils/status';
import { getRunTitle } from './AutomationRunCard';

import { RunSummaryHeader } from './RunSummaryHeader';
import { SafetyGuardPanel } from './SafetyGuardPanel';
import { JobApplicationSelector } from './JobApplicationSelector';
import { TelemetryTimeline } from './TelemetryTimeline';
import { FormInspectionPanel } from './FormInspectionPanel';
import { AutomationLogsViewer } from './AutomationLogsViewer';

interface AutomationRunDetailsPanelProps {
  run: AutomationRun | null;
  onClose?: () => void;
  onRunUpdated: (updated: AutomationRun) => void;
  onNavigateToApplication?: (applicationId?: string) => void;
  onReRun?: (run: AutomationRun) => void;
}

export const AutomationRunDetailsPanel: React.FC<AutomationRunDetailsPanelProps> = ({
  run,
  onClose,
  onRunUpdated,
  onNavigateToApplication,
  onReRun,
}) => {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'form' | 'logs'>('overview');
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const fetchRunData = async () => {
    if (!run) return;
    setIsLoadingDetails(true);
    try {
      const [logsData, appsData] = await Promise.all([
        automationApi.getRunLogs(run.id).catch(() => [] as AutomationLog[]),
        automationApi.getRunApplications(run.id).catch(() => [] as Application[]),
      ]);
      setLogs(logsData);
      setApplications(appsData);

      if (appsData.length > 0) {
        setSelectedApplication((prev) => {
          if (!prev) return appsData[0];
          const found = appsData.find((a) => a.id === prev.id);
          return found || appsData[0];
        });
      } else {
        setSelectedApplication(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  useEffect(() => {
    if (run) {
      fetchRunData();
    }
  }, [run?.id]);

  if (!run) return null;

  const handleCancelRun = async () => {
    setIsCancelling(true);
    try {
      const updated = await automationApi.cancelRun(run.id);
      showSuccess('Automation run cancelled successfully.');
      onRunUpdated(updated);
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsCancelling(false);
    }
  };

  const errorLogCount = logs.filter((l) => (l.level || '').toLowerCase() === 'error').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '16px' }}>
      {/* Mobile back navigation bar */}
      {onClose && (
        <button
          onClick={onClose}
          className="mobile-back-btn"
          style={{
            display: 'none',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '8px',
            color: '#1769C2',
            fontSize: '0.84rem',
            fontWeight: 700,
            cursor: 'pointer',
            width: 'fit-content',
          }}
        >
          <ArrowLeft size={16} />
          <span>← Back to Execution History</span>
        </button>
      )}

      {/* Prominent Run Summary Header across the full width */}
      <RunSummaryHeader
        run={run}
        isCancelling={isCancelling}
        onCancelRun={handleCancelRun}
        onReRun={onReRun}
      />

      {/* Segmented Section Tab Controls */}
      <div
        role="tablist"
        aria-label="Run details navigation tabs"
        style={{
          display: 'flex',
          gap: '6px',
          backgroundColor: '#F1F5F9',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid #E2E8F0',
          flexWrap: 'wrap',
          width: '100%',
        }}
      >
        <button
          role="tab"
          aria-selected={activeTab === 'overview'}
          onClick={() => setActiveTab('overview')}
          className={`btn ${activeTab === 'overview' ? 'btn-primary' : 'btn-outline'}`}
          style={{
            flex: 1,
            minWidth: '110px',
            minHeight: '38px',
            fontSize: '0.82rem',
            fontWeight: 600,
            border: 'none',
            borderRadius: '8px',
            backgroundColor: activeTab === 'overview' ? '#1769C2' : 'transparent',
            color: activeTab === 'overview' ? '#FFFFFF' : '#475569',
            boxShadow: activeTab === 'overview' ? '0 1px 3px rgba(23, 105, 194, 0.25)' : 'none',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <ShieldCheck size={15} />
          <span>Overview</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'timeline'}
          onClick={() => setActiveTab('timeline')}
          className={`btn ${activeTab === 'timeline' ? 'btn-primary' : 'btn-outline'}`}
          style={{
            flex: 1,
            minWidth: '110px',
            minHeight: '38px',
            fontSize: '0.82rem',
            fontWeight: 600,
            border: 'none',
            borderRadius: '8px',
            backgroundColor: activeTab === 'timeline' ? '#1769C2' : 'transparent',
            color: activeTab === 'timeline' ? '#FFFFFF' : '#475569',
            boxShadow: activeTab === 'timeline' ? '0 1px 3px rgba(23, 105, 194, 0.25)' : 'none',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <ListOrdered size={15} />
          <span>Timeline</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'form'}
          onClick={() => setActiveTab('form')}
          className={`btn ${activeTab === 'form' ? 'btn-primary' : 'btn-outline'}`}
          style={{
            flex: 1,
            minWidth: '110px',
            minHeight: '38px',
            fontSize: '0.82rem',
            fontWeight: 600,
            border: 'none',
            borderRadius: '8px',
            backgroundColor: activeTab === 'form' ? '#1769C2' : 'transparent',
            color: activeTab === 'form' ? '#FFFFFF' : '#475569',
            boxShadow: activeTab === 'form' ? '0 1px 3px rgba(23, 105, 194, 0.25)' : 'none',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <FileQuestion size={15} />
          <span>Form Inspector</span>
        </button>

        <button
          role="tab"
          aria-selected={activeTab === 'logs'}
          onClick={() => setActiveTab('logs')}
          className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-outline'}`}
          style={{
            flex: 1,
            minWidth: '110px',
            minHeight: '38px',
            fontSize: '0.82rem',
            fontWeight: 600,
            border: 'none',
            borderRadius: '8px',
            backgroundColor: activeTab === 'logs' ? '#1769C2' : 'transparent',
            color: activeTab === 'logs' ? '#FFFFFF' : '#475569',
            boxShadow: activeTab === 'logs' ? '0 1px 3px rgba(23, 105, 194, 0.25)' : 'none',
            transition: 'all 0.15s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}
        >
          <Terminal size={15} />
          <span>Logs ({logs.length})</span>
          {errorLogCount > 0 && (
            <span
              style={{
                backgroundColor: activeTab === 'logs' ? 'rgba(255, 255, 255, 0.2)' : '#FEF2F2',
                color: activeTab === 'logs' ? '#FFFFFF' : '#DC2626',
                border: activeTab === 'logs' ? 'none' : '1px solid #FECACA',
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '9999px',
              }}
            >
              {errorLogCount} error{errorLogCount === 1 ? '' : 's'}
            </span>
          )}
        </button>
      </div>

      {/* Active Section Content */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Top Overview Cards: Run Summary & Key Insights matching design reference */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Card 1: Run Summary */}
            <div
              className="card"
              style={{
                padding: '18px 20px',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                backgroundColor: '#FFFFFF',
                marginBottom: 0,
              }}
            >
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', margin: '0 0 10px 0' }}>
                Run Summary
              </h4>

              <p style={{ fontSize: '0.8rem', color: '#475569', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                This {run.dry_run ? 'dry run' : 'live run'} searched for {getRunTitle(run)} on LinkedIn, applied your filters, and evaluated {run.jobs_processed || 0} potential opportunities.{' '}
                {run.dry_run
                  ? 'No applications were submitted because this was a dry run.'
                  : `${run.applications_submitted || 0} applications were submitted.`}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.78rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Run Mode</span>
                  <span style={{ fontWeight: 700, color: run.dry_run ? '#1769C2' : '#B45309' }}>
                    {run.dry_run ? 'Dry Run' : 'Live Run'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Platform</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>LinkedIn</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Search Criteria</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>
                    {run.search_config?.name || getRunTitle(run)}, {run.search_config?.location || 'Remote'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Started At</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>
                    {run.started_at ? `${formatDate(run.started_at)}, ${formatTime(run.started_at)}` : 'N/A'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #F1F5F9', paddingBottom: '6px' }}>
                  <span style={{ color: '#64748B' }}>Completed At</span>
                  <span style={{ fontWeight: 600, color: '#0F172A' }}>
                    {run.completed_at
                      ? `${formatDate(run.completed_at)}, ${formatTime(run.completed_at)}`
                      : normalizeRunStatus(run.status) === 'running'
                      ? 'In progress'
                      : '—'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '2px' }}>
                  <span style={{ color: '#64748B' }}>Duration</span>
                  <span style={{ fontWeight: 700, color: '#0F172A' }}>
                    {formatRunDuration(run.started_at, run.completed_at, run.status, run.created_at)}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Key Insights */}
            <div
              className="card"
              style={{
                padding: '18px 20px',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                backgroundColor: '#FFFFFF',
                marginBottom: 0,
              }}
            >
              <h4 style={{ fontSize: '0.92rem', fontWeight: 800, color: '#0F172A', margin: '0 0 14px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Layers size={16} color="#1769C2" />
                <span>Key Insights</span>
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* 1. Relevant jobs */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: '#EFF6FF',
                      color: '#1769C2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Search size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>
                      {run.jobs_found || 0} relevant jobs found
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: '1px' }}>
                      Based on your search criteria and location.
                    </div>
                  </div>
                </div>

                {/* 2. Matched profile */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: '#F0FDF4',
                      color: '#16A34A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FileCheck size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>
                      {run.jobs_processed || 0} jobs matched your profile
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: '1px' }}>
                      Met your skills, experience, and other criteria.
                    </div>
                  </div>
                </div>

                {/* 3. Submissions */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: '#ECFEFF',
                      color: '#0891B2',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Info size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>
                      {run.dry_run ? 'No applications submitted' : `${run.applications_submitted || 0} applications submitted`}
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: '1px' }}>
                      {run.dry_run
                        ? 'This was a dry run, so no applications were submitted.'
                        : 'Submitted with verified user session credentials.'}
                    </div>
                  </div>
                </div>

                {/* 4. Health / error status */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      backgroundColor: (run.applications_failed || 0) === 0 ? '#F0FDF4' : '#FEF2F2',
                      color: (run.applications_failed || 0) === 0 ? '#16A34A' : '#DC2626',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <CheckCircle2 size={14} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0F172A' }}>
                      {(run.applications_failed || 0) === 0
                        ? 'All evaluations completed successfully'
                        : `${run.applications_failed} applications encountered errors`}
                    </div>
                    <div style={{ fontSize: '0.73rem', color: '#64748B', marginTop: '1px' }}>
                      {(run.applications_failed || 0) === 0
                        ? 'No errors encountered during processing.'
                        : 'Review logs and form heuristics for detailed failure causes.'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Triple-Key Safety Guard and Application Selector */}
          <div className="run-details-grid">
            <div className="run-details-middle-panel" style={{ flex: 1, minWidth: '280px' }}>
              <SafetyGuardPanel run={run} />
            </div>

            <div
              className="run-details-right-panel card"
              style={{
                flex: 1.2,
                minWidth: '280px',
                padding: '16px',
                border: '1px solid #E2E8F0',
                borderRadius: '12px',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                marginBottom: 0,
              }}
            >
              <JobApplicationSelector
                applications={applications}
                selectedAppId={selectedApplication?.id || null}
                onSelectApplication={(app) => setSelectedApplication(app)}
                onNavigateToApplication={onNavigateToApplication}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'timeline' && (
        <div className="run-details-right-panel" style={{ width: '100%', flex: 1 }}>
          <TelemetryTimeline
            logs={logs}
            selectedApplication={selectedApplication}
            dryRun={run.dry_run}
          />
        </div>
      )}

      {activeTab === 'form' && (
        <div className="run-details-right-panel" style={{ width: '100%', flex: 1 }}>
          <FormInspectionPanel application={selectedApplication} />
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="run-details-right-panel" style={{ width: '100%', flex: 1 }}>
          <AutomationLogsViewer
            logs={logs}
            isLoading={isLoadingDetails}
            onRefresh={fetchRunData}
          />
        </div>
      )}
    </div>
  );
};
