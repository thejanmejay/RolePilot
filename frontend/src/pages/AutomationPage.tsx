import React, { useEffect, useState, useRef } from 'react';
import {
  Bot,
  Play,
  RefreshCw,
} from 'lucide-react';
import { automationApi } from '../api/automation';
import { useAuth } from '../context/AuthContext';
import { formatErrorMessage } from '../api/client';
import { normalizeRunStatus, isTerminalRunStatus } from '../utils/status';
import { AutomationStats } from '../components/automation/AutomationStats';
import { AutomationRunCard } from '../components/automation/AutomationRunCard';
import { AutomationRunDetailsPanel } from '../components/automation/AutomationRunDetailsPanel';
import { TriggerAutomationModal } from '../components/automation/TriggerAutomationModal';
import { EmptyState, ErrorState, ListCardSkeleton } from '../components/common';
import type { AutomationRun } from '../types/automation';

interface AutomationPageProps {
  initialRunId?: string | null;
  onClearInitialRun?: () => void;
  onNavigateToApplication?: (applicationId?: string) => void;
  onNavigateTab?: (tab: 'dashboard' | 'profile' | 'jobs' | 'applications' | 'automation') => void;
  isActive?: boolean;
}

export const AutomationPage: React.FC<AutomationPageProps> = ({
  initialRunId,
  onClearInitialRun,
  onNavigateToApplication,
  onNavigateTab,
  isActive = true,
}) => {
  const { isAuthenticated } = useAuth();

  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Trigger modal
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState<boolean>(false);

  const pollTimerRef = useRef<number | null>(null);
  const prevActiveRef = useRef<boolean>(isActive);
  const lastPollTimestampRef = useRef<number>(0);

  // Sync initialRunId when navigating from Dashboard
  useEffect(() => {
    if (initialRunId && runs.length > 0) {
      const match = runs.find((r) => r.id === initialRunId);
      if (match) {
        setSelectedRun(match);
      }
      if (onClearInitialRun) {
        onClearInitialRun();
      }
    }
  }, [initialRunId, runs, onClearInitialRun]);

  const fetchRuns = async (isBackgroundPoll = false) => {
    const reqTimestamp = Date.now();
    if (!isBackgroundPoll) setIsLoading(true);
    setError(null);
    try {
      // Force fresh network fetch, completely bypassing in-memory cache
      const data = await automationApi.getRuns(0, 50, true);

      // Prevent out-of-order race conditions from delayed network requests
      if (reqTimestamp < lastPollTimestampRef.current) {
        return;
      }
      lastPollTimestampRef.current = reqTimestamp;

      setRuns((prev) => {
        // Guard terminal state: if a local run is already terminal, never let a late poll revert it to running
        const merged = data.map((fetchedRun) => {
          const existing = prev.find((r) => r.id === fetchedRun.id);
          if (existing && isTerminalRunStatus(existing.status) && !isTerminalRunStatus(fetchedRun.status)) {
            return existing;
          }
          return fetchedRun;
        });

        // Update selectedRun reference to keep view synchronized
        setSelectedRun((prevSelected) => {
          if (!prevSelected) return merged[0] || null;
          const found = merged.find((r) => r.id === prevSelected.id);
          return found || merged[0] || null;
        });

        return merged;
      });
    } catch (err) {
      if (!isBackgroundPoll) {
        setError(formatErrorMessage(err));
      }
    } finally {
      if (!isBackgroundPoll) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchRuns();
    }
  }, [isAuthenticated]);

  // Silent refresh when becoming active again
  useEffect(() => {
    if (isActive && !prevActiveRef.current && isAuthenticated) {
      fetchRuns(true);
    }
    prevActiveRef.current = isActive;
  }, [isActive, isAuthenticated]);

  // Active polling ONLY when tab is active and there is a running/queued task
  useEffect(() => {
    if (!isActive) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const hasActiveRuns = runs.some((r) => {
      const s = normalizeRunStatus(r.status);
      return s === 'running' || s === 'queued';
    });

    if (hasActiveRuns) {
      if (!pollTimerRef.current) {
        pollTimerRef.current = window.setInterval(() => {
          fetchRuns(true);
        }, 3000);
      }
    } else if (pollTimerRef.current) {
      // Immediately stop polling once all runs reach terminal state
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [isActive, runs]);

  const handleRunTriggered = (newRun: AutomationRun) => {
    setRuns((prev) => [newRun, ...prev]);
    setSelectedRun(newRun);
  };

  const handleRunUpdated = (updated: AutomationRun) => {
    setRuns((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    if (selectedRun?.id === updated.id) {
      setSelectedRun(updated);
    }
  };

  const handleReRun = (_run: AutomationRun) => {
    setIsTriggerModalOpen(true);
  };

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
          <h1 style={{ fontSize: '1.65rem', fontWeight: 800, color: '#172554', margin: 0, display: 'flex', alignItems: 'center', gap: '10px', letterSpacing: '-0.02em' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#DBEAFE',
                color: '#1769C2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Bot size={22} />
            </div>
            <span>Automation Runner</span>
          </h1>
          <p style={{ fontSize: '0.88rem', color: '#64748B', marginTop: '6px', marginBottom: 0 }}>
            Monitors LinkedIn job search, qualification, and application execution.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setIsTriggerModalOpen(true)}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#1769C2',
              color: '#FFFFFF',
              fontWeight: 700,
              padding: '9px 18px',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(23, 105, 194, 0.2)',
              minHeight: '40px',
            }}
          >
            <Play size={16} />
            <span>Launch Automation</span>
          </button>

          <button
            onClick={() => fetchRuns(false)}
            className="btn btn-outline"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #E5E7EB',
              color: '#172554',
              fontWeight: 600,
              padding: '9px 16px',
              borderRadius: '8px',
              minHeight: '40px',
            }}
            disabled={isLoading}
          >
            <RefreshCw size={15} className={isLoading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top statistics summary */}
      <AutomationStats runs={runs} />

      {/* Error alert */}
      {error && <ErrorState message={error} onRetry={() => fetchRuns(false)} />}

      {/* Main split dashboard */}
      {isLoading ? (
        <ListCardSkeleton count={3} />
      ) : runs.length === 0 ? (
        /* Empty state */
        <EmptyState
          icon={Bot}
          title="No automation runs executed yet"
          description="RolePilot searches based on your target keywords, matches your skills, and automates job applications in the background."
          actionText="Launch Your First Run"
          onAction={() => setIsTriggerModalOpen(true)}
        />
      ) : (
        /* Reference Design Two-Column Workspace: Run Details on Left (65-70%), Run History on Right (30-35%) */
        <div className="automation-dashboard-layout">
          {/* Left Panel: Run Details (65-70%) */}
          <div className="automation-details-container" style={{ flex: 1, minWidth: 0 }}>
            {selectedRun ? (
              <div
                className="card"
                style={{
                  padding: '24px 24px',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  backgroundColor: '#FFFFFF',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                }}
              >
                <AutomationRunDetailsPanel
                  run={selectedRun}
                  onClose={() => setSelectedRun(null)}
                  onRunUpdated={handleRunUpdated}
                  onNavigateToApplication={onNavigateToApplication}
                  onReRun={handleReRun}
                />
              </div>
            ) : (
              <div
                className="card"
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  color: '#64748B',
                  border: '1px solid #E2E8F0',
                  borderRadius: '12px',
                  backgroundColor: '#FFFFFF',
                }}
              >
                <Bot size={36} color="#1769C2" style={{ opacity: 0.4, margin: '0 auto 12px' }} />
                <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0F172A', marginBottom: '6px' }}>
                  No Run Selected
                </div>
                <p style={{ fontSize: '0.84rem', color: '#64748B', maxWidth: '440px', margin: '0 auto', lineHeight: 1.5 }}>
                  Select an execution run from the Run History on the right to inspect its configuration, step telemetry, form heuristics, and logs.
                </p>
              </div>
            )}
          </div>

          {/* Right Panel: Run History (30-35%) */}
          <div
            className={`card automation-history-panel ${selectedRun ? '' : ''}`}
            style={{
              padding: '18px 18px',
              border: '1px solid #E2E8F0',
              borderRadius: '12px',
              backgroundColor: '#FFFFFF',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
              minWidth: '320px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.01em' }}>
                Run History
              </h3>
              <button
                type="button"
                onClick={() => fetchRuns(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#1769C2',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: '4px',
                }}
              >
                View All
              </button>
            </div>

            <div
              className="custom-scrollbar"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                maxHeight: '740px',
                overflowY: 'auto',
              }}
            >
              {runs.map((run) => (
                <AutomationRunCard
                  key={run.id}
                  run={run}
                  isSelected={selectedRun?.id === run.id}
                  onSelect={() => setSelectedRun(run)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trigger Modal */}
      <TriggerAutomationModal
        isOpen={isTriggerModalOpen}
        onClose={() => setIsTriggerModalOpen(false)}
        onRunTriggered={handleRunTriggered}
        onNavigateTab={onNavigateTab}
      />
    </div>
  );
};
