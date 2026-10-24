import React, { useEffect, useState, useRef } from 'react';
import {
  Bot,
  Play,
  RefreshCw,
} from 'lucide-react';
import { automationApi } from '../api/automation';
import { useAuth } from '../context/AuthContext';
import { formatErrorMessage } from '../api/client';
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
}

export const AutomationPage: React.FC<AutomationPageProps> = ({
  initialRunId,
  onClearInitialRun,
  onNavigateToApplication,
  onNavigateTab,
}) => {
  const { isAuthenticated } = useAuth();

  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Trigger modal
  const [isTriggerModalOpen, setIsTriggerModalOpen] = useState<boolean>(false);

  const pollTimerRef = useRef<number | null>(null);

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
    if (!isBackgroundPoll) setIsLoading(true);
    setError(null);
    try {
      const data = await automationApi.getRuns();
      setRuns(data);

      if (data.length > 0) {
        setSelectedRun((prev) => {
          if (!prev) return data[0];
          const found = data.find((r) => r.id === prev.id);
          return found || data[0];
        });
      } else {
        setSelectedRun(null);
      }
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

  // Active polling when there is a running/queued task
  useEffect(() => {
    const hasActiveRuns = runs.some((r) => r.status === 'running' || r.status === 'queued');

    if (hasActiveRuns) {
      pollTimerRef.current = window.setInterval(() => {
        fetchRuns(true);
      }, 3000);
    } else if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
      }
    };
  }, [runs]);

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
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Bot size={28} color="var(--primary)" />
            <span>Hunter Automation Runner</span>
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Autonomous LinkedIn job search, qualification evaluation, and application engine.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setIsTriggerModalOpen(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Play size={16} />
            <span>Launch Automation</span>
          </button>

          <button
            onClick={() => fetchRuns(false)}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'spin' : ''} />
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
          description="Hunter searches LinkedIn based on your target keywords, matches your skills, and automates job applications in the background."
          actionText="Launch Your First Run"
          onAction={() => setIsTriggerModalOpen(true)}
        />
      ) : (
        /* Responsive View */
        <div className="automation-page-grid">
          {/* Runs List (Hidden on mobile when a run details view is active) */}
          <div className={selectedRun ? 'desktop-only' : ''}>
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '12px' }}>
              Execution History ({runs.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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

          {/* Selected Run Inspector, Telemetry & Logs */}
          {selectedRun ? (
            <div>
              <AutomationRunDetailsPanel
                run={selectedRun}
                onClose={() => setSelectedRun(null)}
                onRunUpdated={handleRunUpdated}
                onNavigateToApplication={onNavigateToApplication}
              />
            </div>
          ) : (
            <div
              className="card desktop-only"
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <Bot size={36} style={{ opacity: 0.3, margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                No Run Selected
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Select an execution run from the history list to inspect its step telemetry, Triple-Key safety state, form heuristics, and event stream.
              </p>
            </div>
          )}
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
