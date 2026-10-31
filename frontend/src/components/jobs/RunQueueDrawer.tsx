import React, { useState } from 'react';
import {
  ListChecks,
  X,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
  Zap,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';
import type { Job } from '../../types/job';
import { isJobEasyApply } from '../../utils/jobHelpers';

interface RunQueueDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  queuedJobs: Job[];
  onRemoveJob: (jobId: string) => void;
  onClearQueue: () => void;
  onProceedToReview: (mode: 'dry_run' | 'live', targetJobs: Job[]) => void;
}

export const RunQueueDrawer: React.FC<RunQueueDrawerProps> = ({
  isOpen,
  onClose,
  queuedJobs,
  onRemoveJob,
  onClearQueue,
  onProceedToReview,
}) => {
  const [selectedMode, setSelectedMode] = useState<'dry_run' | 'live'>('dry_run');
  const [selectedLiveJobId, setSelectedLiveJobId] = useState<string | null>(null);

  // Auto-select if only 1 job in queue
  React.useEffect(() => {
    if (queuedJobs.length === 1 && !selectedLiveJobId) {
      setSelectedLiveJobId(queuedJobs[0].id);
    } else if (selectedLiveJobId && !queuedJobs.some((j) => j.id === selectedLiveJobId)) {
      setSelectedLiveJobId(null);
    }
  }, [queuedJobs, selectedLiveJobId]);

  if (!isOpen) return null;

  const totalCount = queuedJobs.length;
  const easyApplyCount = queuedJobs.filter((j) => isJobEasyApply(j)).length;

  const handleProceed = () => {
    if (selectedMode === 'live') {
      if (!selectedLiveJobId) return;
      const target = queuedJobs.filter((j) => j.id === selectedLiveJobId);
      if (target.length !== 1) return;
      onProceedToReview('live', target);
    } else {
      onProceedToReview('dry_run', queuedJobs);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(17, 24, 39, 0.45)',
          backdropFilter: 'blur(2px)',
          zIndex: 1000,
        }}
        aria-hidden="true"
      />

      {/* Drawer Container */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="queue-drawer-title"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          maxWidth: '460px',
          backgroundColor: '#ffffff',
          boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
          zIndex: 1001,
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.25s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ListChecks size={20} />
            </div>
            <div>
              <h2 id="queue-drawer-title" style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                Application Run Queue
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {totalCount} job{totalCount === 1 ? '' : 's'} queued ({easyApplyCount} Easy Apply)
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            aria-label="Close run queue"
          >
            <X size={20} />
          </button>
        </div>

        {/* Mode Selector */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: 'var(--bg-subtle)',
            borderBottom: '1px solid var(--border-light)',
          }}
        >
          <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
            Select Run Execution Mode:
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {/* Dry Run Option */}
            <div
              onClick={() => setSelectedMode('dry_run')}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${selectedMode === 'dry_run' ? 'var(--primary)' : 'var(--border-light)'}`,
                backgroundColor: selectedMode === 'dry_run' ? '#f0f7ff' : '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <ShieldCheck size={18} color={selectedMode === 'dry_run' ? 'var(--primary)' : 'var(--text-muted)'} />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: selectedMode === 'dry_run' ? 'var(--primary)' : 'var(--text-main)' }}>
                  Dry Run
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  Safe test (no submission)
                </div>
              </div>
            </div>

            {/* Live Option */}
            <div
              onClick={() => setSelectedMode('live')}
              style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: `2px solid ${selectedMode === 'live' ? 'var(--warning)' : 'var(--border-light)'}`,
                backgroundColor: selectedMode === 'live' ? '#fffbeb' : '#ffffff',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
            >
              <ShieldAlert size={18} color={selectedMode === 'live' ? 'var(--warning)' : 'var(--text-muted)'} />
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: selectedMode === 'live' ? '#b45309' : 'var(--text-main)' }}>
                  Live Mode
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  1 job max · Triple-Key
                </div>
              </div>
            </div>
          </div>

          {selectedMode === 'live' && (
            <div
              style={{
                marginTop: '10px',
                padding: '10px 12px',
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '6px',
                fontSize: '0.78rem',
                color: '#92400E',
                lineHeight: 1.4,
              }}
              role="alert"
            >
              <strong>Live Mode Safety:</strong> Live submission supports exactly <strong>1 job per run</strong>. Select the specific job below using the radio button. Real submission requires full Triple-Key authorization before any application is dispatched.
            </div>
          )}
        </div>

        {/* Job List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {queuedJobs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-muted)' }}>
              <ListChecks size={36} style={{ opacity: 0.35, marginBottom: '10px' }} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No jobs in queue</div>
              <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>
                Select jobs from the explorer using the checkboxes to add them to your queue.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {queuedJobs.map((job, idx) => {
                const easyApply = isJobEasyApply(job);
                const isSelectedForLive = selectedMode === 'live' && selectedLiveJobId === job.id;

                return (
                  <div
                    key={job.id}
                    onClick={() => {
                      if (selectedMode === 'live') setSelectedLiveJobId(job.id);
                    }}
                    style={{
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isSelectedForLive ? '#f59e0b' : 'var(--border-light)'}`,
                      backgroundColor: isSelectedForLive ? '#fffdf5' : '#ffffff',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: '12px',
                      boxShadow: isSelectedForLive ? '0 0 0 1px #f59e0b' : '0 1px 2px rgba(0,0,0,0.03)',
                      cursor: selectedMode === 'live' ? 'pointer' : 'default',
                    }}
                  >
                    {/* Live mode radio indicator */}
                    {selectedMode === 'live' && (
                      <div style={{ paddingTop: '2px', display: 'flex', alignItems: 'center' }}>
                        <input
                          type="radio"
                          id={`live-radio-${job.id}`}
                          name="live-job-selection"
                          checked={selectedLiveJobId === job.id}
                          onChange={() => setSelectedLiveJobId(job.id)}
                          aria-label={`Select ${job.title} at ${job.company} for live submission`}
                          style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#d97706' }}
                        />
                      </div>
                    )}

                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                          #{idx + 1}
                        </span>
                        {isSelectedForLive && (
                          <Badge variant="warning" size="sm">Target for Live</Badge>
                        )}
                        {easyApply ? (
                          <Badge variant="success" size="sm" icon={<Zap size={10} fill="#15803d" />}>
                            Easy Apply
                          </Badge>
                        ) : (
                          <Badge variant="neutral" size="sm" icon={<ExternalLink size={10} />}>
                            External
                          </Badge>
                        )}
                      </div>

                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: '0.88rem',
                          color: 'var(--text-main)',
                          lineHeight: 1.3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                        }}
                      >
                        {job.title}
                      </div>

                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {job.company} · {job.location || 'Remote'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onRemoveJob(job.id)}
                      className="btn-icon"
                      title="Remove from queue"
                      aria-label={`Remove ${job.title} from queue`}
                      style={{ color: 'var(--text-subtle)', padding: '6px' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {queuedJobs.length > 0 && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--border-light)',
              backgroundColor: 'var(--bg-card)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                type="button"
                onClick={onClearQueue}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                Clear Queue
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {selectedMode === 'live'
                  ? selectedLiveJobId
                    ? '1 job selected for live submission'
                    : 'Select 1 job to proceed'
                  : `${queuedJobs.length} jobs targeted`}
              </span>
            </div>

            <Button
              variant={selectedMode === 'live' ? 'danger' : 'primary'}
              fullWidth
              disabled={selectedMode === 'live' && !selectedLiveJobId}
              onClick={handleProceed}
              rightIcon={<ArrowRight size={16} />}
            >
              {selectedMode === 'live'
                ? selectedLiveJobId
                  ? 'Proceed to Live Review (1 Job)'
                  : 'Select a Job for Live Submission'
                : 'Proceed to Review & Run'}
            </Button>
          </div>
        )}
      </div>
    </>
  );
};

