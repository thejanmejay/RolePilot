import React, { useState } from 'react';
import { Play, ShieldCheck, Sliders, ArrowRight, Loader2, Sparkles, MapPin } from 'lucide-react';
import { automationApi } from '../../api/automation';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';
import { linkedinApi } from '../../api/linkedin';
import type { SearchConfig } from '../../types/job';

interface QuickActionRunnerProps {
  activeSearchConfig: SearchConfig | null;
  onNavigateTab: (tab: 'profile' | 'jobs' | 'applications' | 'automation') => void;
  onRunTriggered: () => void;
  onRequireLinkedInConsent?: () => void;
}

export const QuickActionRunner: React.FC<QuickActionRunnerProps> = ({
  activeSearchConfig,
  onNavigateTab,
  onRunTriggered,
  onRequireLinkedInConsent,
}) => {
  const { showSuccess, showError } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLaunchQuickDryRun = async () => {
    setIsSubmitting(true);
    try {
      // Gate check: verify LinkedIn connection & consent lifecycle
      const statusData = await linkedinApi.getStatus().catch(() => null);
      if (!statusData?.is_connected || !statusData?.has_consent || statusData?.status === 'expired') {
        if (onRequireLinkedInConsent) {
          onRequireLinkedInConsent();
        } else {
          showError('LinkedIn session connection and automation consent required.');
        }
        setIsSubmitting(false);
        return;
      }

      await automationApi.createRun({
        search_config_id: activeSearchConfig?.id,
        dry_run: true,
        max_jobs: 5,
      });

      showSuccess('Safe Dry-Run automation triggered successfully!');
      onRunTriggered();
      onNavigateTab('automation');
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const keywordsDisplay = activeSearchConfig?.keywords || 'Software Engineer / SDET';
  const locationDisplay = activeSearchConfig?.location || 'India';

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <div>
          <h2 className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            Quick Automation Runner
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            One-click safe dry run with full heuristic modal traversal
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            fontWeight: 700,
            color: 'var(--primary)',
            backgroundColor: 'var(--primary-light)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
          }}
        >
          <ShieldCheck size={14} />
          <span>Dry Run Safe</span>
        </div>
      </div>

      <div style={{ padding: '20px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div>
          {/* Active Target Banner */}
          <div
            style={{
              padding: '14px 16px',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
            }}
          >
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
              CURRENT SEARCH CRITERIA
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Sparkles size={16} color="var(--primary)" />
              <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                {keywordsDisplay}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <MapPin size={14} />
              <span>{locationDisplay}</span>
            </div>
          </div>

          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: '16px' }}>
            Dry runs collect matching jobs, evaluate form fields, populate answers using your profile rules, and inspect the review screen without clicking the final submit button.
          </p>
        </div>

        <div>
          <button
            onClick={handleLaunchQuickDryRun}
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 18px',
              fontSize: '0.95rem',
              fontWeight: 700,
              minHeight: '48px',
              borderRadius: 'var(--radius-md)',
            }}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="spin-animation" />
                <span>Launching Dry Run...</span>
              </>
            ) : (
              <>
                <Play size={18} fill="currentColor" />
                <span>Launch 1-Click Dry Run (5 Jobs)</span>
              </>
            )}
          </button>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: '12px',
              fontSize: '0.8rem',
            }}
          >
            <button
              onClick={() => onNavigateTab('jobs')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 0',
              }}
            >
              <Sliders size={14} />
              <span>Change Search Filter</span>
            </button>

            <button
              onClick={() => onNavigateTab('automation')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--primary)',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 0',
              }}
            >
              <span>Custom & Live Mode</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
