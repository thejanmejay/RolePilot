import React from 'react';
import {
  User,
  Briefcase,
  GraduationCap,
  Code,
  Award,
  Globe,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Info,
} from 'lucide-react';
import { ProgressBar } from '../common/loading/ProgressBar';

export interface ExtractionStageItem {
  id: string;
  label: string;
  status: 'completed' | 'current' | 'pending' | 'error';
  timestamp?: string;
}

export interface ExtractionProgressStepProps {
  stages: ExtractionStageItem[];
  progressPct?: number;
  errorMessage?: string | null;
  onRetry?: () => void;
  onCancel?: () => void;
}

export const ExtractionProgressStep: React.FC<ExtractionProgressStepProps> = ({
  stages,
  progressPct = 68,
  errorMessage,
  onRetry,
  onCancel,
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '680px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Title & Subtitle */}
      <div style={{ textAlign: 'center' }}>
        <h1
          style={{
            fontSize: '1.85rem',
            fontWeight: 800,
            color: '#101A3A',
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
          }}
        >
          We're extracting your information
        </h1>
        <p
          style={{
            fontSize: '0.96rem',
            color: '#64748B',
            maxWidth: '540px',
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          Our AI is reading your resume and identifying key details like your experience, skills, education, and more.
        </p>
      </div>

      {/* Central Illustration Area with Document & Floating Badges */}
      <div
        style={{
          position: 'relative',
          height: '240px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#F8FAFC',
          borderRadius: '16px',
          border: '1px solid #E2E8F0',
          overflow: 'hidden',
          padding: '20px',
          boxSizing: 'border-box',
        }}
      >
        {/* Floating Badges */}
        {/* Top Left: Personal Details */}
        <div
          style={{
            position: 'absolute',
            top: '28px',
            left: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#1D4ED8',
            borderRadius: '9999px',
            padding: '6px 14px',
            fontSize: '0.8rem',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)',
          }}
        >
          <User size={14} color="#2563EB" />
          <span>Personal Details</span>
        </div>

        {/* Mid Left: Education */}
        <div
          style={{
            position: 'absolute',
            top: '100px',
            left: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            color: '#B45309',
            borderRadius: '9999px',
            padding: '6px 14px',
            fontSize: '0.8rem',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)',
          }}
        >
          <GraduationCap size={14} color="#D97706" />
          <span>Education</span>
        </div>

        {/* Bottom Left: Certifications */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            left: '36px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#B91C1C',
            borderRadius: '9999px',
            padding: '6px 14px',
            fontSize: '0.8rem',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(220, 38, 38, 0.08)',
          }}
        >
          <Award size={14} color="#DC2626" />
          <span>Certifications</span>
        </div>

        {/* Central Document Graphic */}
        <div
          style={{
            width: '110px',
            height: '148px',
            backgroundColor: '#FFFFFF',
            borderRadius: '10px',
            border: '1px solid #CBD5E1',
            boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.1)',
            padding: '14px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 2,
          }}
        >
          <div style={{ width: '45%', height: '6px', backgroundColor: '#94A3B8', borderRadius: '3px' }} />
          <div style={{ width: '85%', height: '4px', backgroundColor: '#E2E8F0', borderRadius: '2px' }} />
          <div style={{ width: '70%', height: '4px', backgroundColor: '#E2E8F0', borderRadius: '2px' }} />
          <div style={{ width: '100%', height: '1px', backgroundColor: '#F1F5F9', margin: '2px 0' }} />
          <div style={{ width: '60%', height: '5px', backgroundColor: '#94A3B8', borderRadius: '3px' }} />
          <div style={{ width: '90%', height: '4px', backgroundColor: '#E2E8F0', borderRadius: '2px' }} />
          <div style={{ width: '75%', height: '4px', backgroundColor: '#E2E8F0', borderRadius: '2px' }} />
          <div style={{ width: '100%', height: '1px', backgroundColor: '#F1F5F9', margin: '2px 0' }} />
          <div style={{ width: '50%', height: '5px', backgroundColor: '#94A3B8', borderRadius: '3px' }} />
          <div style={{ width: '80%', height: '4px', backgroundColor: '#E2E8F0', borderRadius: '2px' }} />
        </div>

        {/* Top Right: Work Experience */}
        <div
          style={{
            position: 'absolute',
            top: '28px',
            right: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#FAF5FF',
            border: '1px solid #E9D5FF',
            color: '#7E22CE',
            borderRadius: '9999px',
            padding: '6px 14px',
            fontSize: '0.8rem',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(126, 34, 206, 0.08)',
          }}
        >
          <Briefcase size={14} color="#9333EA" />
          <span>Work Experience</span>
        </div>

        {/* Mid Right: Technical Skills */}
        <div
          style={{
            position: 'absolute',
            top: '100px',
            right: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            color: '#15803D',
            borderRadius: '9999px',
            padding: '6px 14px',
            fontSize: '0.8rem',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(22, 163, 74, 0.08)',
          }}
        >
          <Code size={14} color="#16A34A" />
          <span>Technical Skills</span>
        </div>

        {/* Bottom Right: Online Profiles */}
        <div
          style={{
            position: 'absolute',
            bottom: '28px',
            right: '36px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#EFF6FF',
            border: '1px solid #BFDBFE',
            color: '#1D4ED8',
            borderRadius: '9999px',
            padding: '6px 14px',
            fontSize: '0.8rem',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)',
          }}
        >
          <Globe size={14} color="#2563EB" />
          <span>Online Profiles</span>
        </div>
      </div>

      {/* Progress Bar & Label */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px',
            fontSize: '0.86rem',
            fontWeight: 600,
            color: '#334155',
          }}
        >
          <span>Extracting and mapping information...</span>
          <span>{progressPct}%</span>
        </div>
        <ProgressBar value={progressPct} height={8} variant="primary" />
      </div>

      {/* Error state if occurred */}
      {errorMessage && (
        <div
          role="alert"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            padding: '16px 20px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '12px',
            color: '#B91C1C',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>Extraction Encountered an Issue</div>
              <div style={{ fontSize: '0.84rem', marginTop: '4px', lineHeight: 1.45 }}>{errorMessage}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="btn btn-secondary"
                style={{ fontSize: '0.82rem', padding: '6px 14px' }}
              >
                Back to Sources
              </button>
            )}
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="btn btn-primary"
                style={{ fontSize: '0.82rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={14} />
                <span>Retry Extraction</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Checklist of Real Processing Stages */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {stages.map((stage) => {
          const isDone = stage.status === 'completed';
          const isCurrent = stage.status === 'current';
          const isErr = stage.status === 'error';

          return (
            <div
              key={stage.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.84rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {isDone ? (
                  <CheckCircle2 size={16} color="#16A34A" />
                ) : isCurrent ? (
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      border: '3px solid #1769E8',
                      borderTopColor: 'transparent',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                ) : isErr ? (
                  <AlertCircle size={16} color="#DC2626" />
                ) : (
                  <div
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: '2px solid #CBD5E1',
                    }}
                  />
                )}
                <span
                  style={{
                    fontWeight: isCurrent ? 700 : 500,
                    color: isErr ? '#DC2626' : isDone ? '#0F172A' : isCurrent ? '#1769E8' : '#94A3B8',
                  }}
                >
                  {stage.label}
                </span>
              </div>

              <span
                style={{
                  fontSize: '0.78rem',
                  color: isDone ? '#64748B' : isCurrent ? '#1769E8' : '#94A3B8',
                  fontWeight: isCurrent ? 600 : 400,
                }}
              >
                {stage.timestamp || (isDone ? 'Completed' : isCurrent ? 'In progress' : 'Pending')}
              </span>
            </div>
          );
        })}
      </div>

      {/* Info Notice */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 18px',
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '10px',
          color: '#1E40AF',
          fontSize: '0.84rem',
        }}
      >
        <Info size={18} color="#1769E8" style={{ flexShrink: 0 }} />
        <span>
          This usually takes 20–40 seconds. You can keep this page open. We'll automatically move you to the next step once it's complete.
        </span>
      </div>
    </div>
  );
};
