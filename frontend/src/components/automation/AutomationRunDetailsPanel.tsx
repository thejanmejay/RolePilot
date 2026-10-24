import React, { useState, useEffect } from 'react';
import {
  ListOrdered,
  FileQuestion,
  Terminal,
} from 'lucide-react';
import type { AutomationRun, AutomationLog } from '../../types/automation';
import type { Application } from '../../api/applications';
import { automationApi } from '../../api/automation';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';

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
}

export const AutomationRunDetailsPanel: React.FC<AutomationRunDetailsPanelProps> = ({
  run,
  onRunUpdated,
  onNavigateToApplication,
}) => {
  const { showSuccess, showError } = useToast();
  const [activeTab, setActiveTab] = useState<'timeline' | 'form' | 'logs'>('timeline');
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Responsive Two-Column Layout (Desktop) / Stacked (Mobile) */}
      <div className="run-details-grid">
        {/* Left Column: Summary, Safety Guard, Job Drill-Down */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Run Summary Header */}
          <RunSummaryHeader
            run={run}
            isCancelling={isCancelling}
            onCancelRun={handleCancelRun}
          />

          {/* Triple-Key Safety Guard Panel */}
          <SafetyGuardPanel run={run} />

          {/* Job Applications Selector & "Why?" Explanation */}
          <div className="card" style={{ padding: '16px' }}>
            <JobApplicationSelector
              applications={applications}
              selectedAppId={selectedApplication?.id || null}
              onSelectApplication={(app) => setSelectedApplication(app)}
              onNavigateToApplication={onNavigateToApplication}
            />
          </div>
        </div>

        {/* Right Column: Telemetry Timeline, Form Inspector, Event Logs */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Segmented Tab Controls */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              backgroundColor: 'var(--bg-subtle)',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              flexWrap: 'wrap',
            }}
          >
            <button
              onClick={() => setActiveTab('timeline')}
              className={`btn ${activeTab === 'timeline' ? 'btn-primary' : 'btn-outline'}`}
              style={{
                flex: 1,
                minWidth: '130px',
                minHeight: '44px',
                fontSize: '0.85rem',
                border: activeTab === 'timeline' ? 'none' : 'transparent',
                backgroundColor: activeTab === 'timeline' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'timeline' ? '#ffffff' : 'var(--text-main)',
              }}
            >
              <ListOrdered size={16} />
              <span>Timeline</span>
            </button>

            <button
              onClick={() => setActiveTab('form')}
              className={`btn ${activeTab === 'form' ? 'btn-primary' : 'btn-outline'}`}
              style={{
                flex: 1,
                minWidth: '130px',
                minHeight: '44px',
                fontSize: '0.85rem',
                border: activeTab === 'form' ? 'none' : 'transparent',
                backgroundColor: activeTab === 'form' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'form' ? '#ffffff' : 'var(--text-main)',
              }}
            >
              <FileQuestion size={16} />
              <span>Form Inspector</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`btn ${activeTab === 'logs' ? 'btn-primary' : 'btn-outline'}`}
              style={{
                flex: 1,
                minWidth: '130px',
                minHeight: '44px',
                fontSize: '0.85rem',
                border: activeTab === 'logs' ? 'none' : 'transparent',
                backgroundColor: activeTab === 'logs' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'logs' ? '#ffffff' : 'var(--text-main)',
              }}
            >
              <Terminal size={16} />
              <span>Logs ({logs.length})</span>
            </button>
          </div>

          {/* Active View Container */}
          {activeTab === 'timeline' && (
            <TelemetryTimeline
              logs={logs}
              selectedApplication={selectedApplication}
              dryRun={run.dry_run}
            />
          )}

          {activeTab === 'form' && (
            <FormInspectionPanel
              application={selectedApplication}
            />
          )}

          {activeTab === 'logs' && (
            <AutomationLogsViewer
              logs={logs}
              isLoading={isLoadingDetails}
              onRefresh={fetchRunData}
            />
          )}
        </div>
      </div>
    </div>
  );
};
