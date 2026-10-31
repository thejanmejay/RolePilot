import React from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  XCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';
import { ProgressBar } from './ProgressBar';
import { Button } from '../Button';

export type ProcessingStatus =
  | 'idle'
  | 'loading'
  | 'uploading'
  | 'processing'
  | 'success'
  | 'partial_success'
  | 'retryable_error'
  | 'terminal_error'
  | 'cancelled';

export interface ProcessingStep {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'current' | 'completed' | 'error';
}

export interface ProcessingStateProps {
  status: ProcessingStatus;
  title: string;
  description?: string;
  progressPct?: number; // 0 - 100 for determinate progress
  steps?: ProcessingStep[];
  errorMessage?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
  onContinue?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const ProcessingState: React.FC<ProcessingStateProps> = ({
  status,
  title,
  description,
  progressPct,
  steps,
  errorMessage,
  onRetry,
  onCancel,
  onContinue,
  className = '',
  style,
}) => {
  const isIndeterminate = status === 'loading' || (status === 'processing' && progressPct === undefined);
  const isDeterminate = (status === 'uploading' || status === 'processing') && progressPct !== undefined;
  const isError = status === 'retryable_error' || status === 'terminal_error';
  const isSuccess = status === 'success' || status === 'partial_success';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`processing-state-panel ${className}`.trim()}
      style={{
        padding: '24px 20px',
        borderRadius: 'var(--radius-lg, 12px)',
        backgroundColor: '#FFFFFF',
        border: isError
          ? '1px solid #FECACA'
          : isSuccess
          ? '1px solid #BBF7D0'
          : '1px solid var(--border, #E5E7EB)',
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.05))',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '16px',
        maxWidth: '560px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {/* Visual State Icon */}
      <div>
        {isIndeterminate && (
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-light, #EFF6FF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LoadingSpinner size="lg" variant="primary" />
          </div>
        )}

        {isDeterminate && (
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--primary-light, #EFF6FF)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LoadingSpinner size="lg" variant="primary" />
          </div>
        )}

        {isSuccess && (
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--success-bg, #DCFCE7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--success, #16A34A)',
            }}
          >
            <CheckCircle2 size={30} />
          </div>
        )}

        {isError && (
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: 'var(--danger-bg, #FEE2E2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--danger, #DC2626)',
            }}
          >
            <AlertCircle size={30} />
          </div>
        )}

        {status === 'cancelled' && (
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: '#F1F5F9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#64748B',
            }}
          >
            <XCircle size={30} />
          </div>
        )}
      </div>

      {/* Title & Description */}
      <div style={{ maxWidth: '440px' }}>
        <h3
          style={{
            margin: '0 0 4px 0',
            fontSize: '1.1rem',
            fontWeight: 700,
            color: 'var(--text-main, #111827)',
          }}
        >
          {title}
        </h3>
        {description && (
          <p
            style={{
              margin: 0,
              fontSize: '0.84rem',
              color: 'var(--text-muted, #64748B)',
              lineHeight: 1.45,
            }}
          >
            {description}
          </p>
        )}
      </div>

      {/* Determinate Progress Bar */}
      {isDeterminate && progressPct !== undefined && (
        <div style={{ width: '100%', maxWidth: '420px', margin: '4px 0' }}>
          <ProgressBar
            value={progressPct}
            showPercentage
            variant={status === 'uploading' ? 'primary' : 'primary'}
            height={8}
          />
        </div>
      )}

      {/* Multi-Stage Step Progress (if provided) */}
      {steps && steps.length > 0 && (
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            textAlign: 'left',
          }}
        >
          {steps.map((step) => {
            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px',
                  fontSize: '0.82rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  {step.status === 'completed' && (
                    <CheckCircle2 size={16} color="var(--success, #16A34A)" style={{ flexShrink: 0 }} />
                  )}
                  {step.status === 'current' && (
                    <LoadingSpinner size="sm" variant="primary" />
                  )}
                  {step.status === 'pending' && (
                    <Clock size={16} color="#94A3B8" style={{ flexShrink: 0 }} />
                  )}
                  {step.status === 'error' && (
                    <AlertTriangle size={16} color="var(--danger, #DC2626)" style={{ flexShrink: 0 }} />
                  )}

                  <span
                    style={{
                      fontWeight: step.status === 'current' ? 700 : 500,
                      color:
                        step.status === 'completed'
                          ? 'var(--text-main, #111827)'
                          : step.status === 'current'
                          ? 'var(--primary, #1769C2)'
                          : step.status === 'error'
                          ? 'var(--danger, #DC2626)'
                          : '#94A3B8',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {step.label}
                  </span>
                </div>

                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    color:
                      step.status === 'completed'
                        ? 'var(--success, #16A34A)'
                        : step.status === 'current'
                        ? 'var(--primary, #1769C2)'
                        : step.status === 'error'
                        ? 'var(--danger, #DC2626)'
                        : '#94A3B8',
                  }}
                >
                  {step.status === 'completed'
                    ? 'Done'
                    : step.status === 'current'
                    ? 'In Progress'
                    : step.status === 'error'
                    ? 'Failed'
                    : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Error Message Alert */}
      {errorMessage && (
        <div
          style={{
            width: '100%',
            maxWidth: '460px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '10px 14px',
            color: '#B91C1C',
            fontSize: '0.82rem',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Action Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
        {status === 'retryable_error' && onRetry && (
          <Button variant="primary" onClick={onRetry}>
            <RotateCcw size={14} style={{ marginRight: '6px' }} />
            <span>Try Again</span>
          </Button>
        )}

        {(status === 'loading' || status === 'uploading' || status === 'processing') && onCancel && (
          <Button variant="outline" onClick={onCancel}>
            <span>Cancel</span>
          </Button>
        )}

        {isSuccess && onContinue && (
          <Button variant="primary" onClick={onContinue}>
            <span>Continue to Review</span>
            <ArrowRight size={14} style={{ marginLeft: '6px' }} />
          </Button>
        )}
      </div>
    </div>
  );
};
