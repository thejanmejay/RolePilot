import React from 'react';
import {
  HelpCircle,
  Hash,
  CheckSquare,
  AlignLeft,
  List,
  FileText,
  Sparkles,
  ShieldCheck,
  Info,
} from 'lucide-react';
import type { ApplicationAnswer } from '../../api/applications';

interface ApplicationAnswersViewerProps {
  answers?: ApplicationAnswer[];
  isLoading?: boolean;
}

export const ApplicationAnswersViewer: React.FC<ApplicationAnswersViewerProps> = ({
  answers = [],
  isLoading = false,
}) => {
  const getQuestionTypeBadge = (type?: string | null) => {
    const norm = (type || 'text').toLowerCase();
    if (norm.includes('num') || norm.includes('digit') || norm.includes('year')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.72rem',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: '#e0f2fe',
            color: '#0369a1',
            fontWeight: 600,
          }}
        >
          <Hash size={11} />
          Numeric
        </span>
      );
    }
    if (norm.includes('bool') || norm.includes('yes') || norm.includes('check')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.72rem',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: '#dcfce7',
            color: '#15803d',
            fontWeight: 600,
          }}
        >
          <CheckSquare size={11} />
          Boolean
        </span>
      );
    }
    if (norm.includes('select') || norm.includes('choice') || norm.includes('radio')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.72rem',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: '#fef3c7',
            color: '#b45309',
            fontWeight: 600,
          }}
        >
          <List size={11} />
          Select
        </span>
      );
    }
    if (norm.includes('file') || norm.includes('upload') || norm.includes('resume')) {
      return (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: '0.72rem',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: '#f3e8ff',
            color: '#7e22ce',
            fontWeight: 600,
          }}
        >
          <FileText size={11} />
          Document
        </span>
      );
    }
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          fontSize: '0.72rem',
          padding: '2px 6px',
          borderRadius: '4px',
          backgroundColor: '#f1f5f9',
          color: '#475569',
          fontWeight: 600,
        }}
      >
        <AlignLeft size={11} />
        Text
      </span>
    );
  };

  const formatConfidence = (conf?: number | null) => {
    if (conf === undefined || conf === null) return '100%';
    const pct = conf <= 1 ? Math.round(conf * 100) : Math.round(conf);
    return `${pct}%`;
  };

  return (
    <div style={{ marginBottom: '22px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
        }}
      >
        <h3
          style={{
            fontSize: '0.95rem',
            fontWeight: 700,
            color: 'var(--text-main)',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <HelpCircle size={16} color="var(--primary)" />
          <span>Form Questions & Answers</span>
          <span
            style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              backgroundColor: 'var(--bg-subtle)',
              padding: '2px 8px',
              borderRadius: '12px',
              color: 'var(--text-muted)',
            }}
          >
            {answers.length}
          </span>
        </h3>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-subtle)',
              }}
            >
              <div className="skeleton" style={{ height: '14px', width: '60%', marginBottom: '8px' }} />
              <div className="skeleton" style={{ height: '18px', width: '35%' }} />
            </div>
          ))}
        </div>
      ) : answers.length === 0 ? (
        <div
          style={{
            padding: '16px',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px dashed var(--border-color)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.85rem',
          }}
        >
          <Info size={18} style={{ opacity: 0.5, margin: '0 auto 6px' }} />
          <div style={{ fontWeight: 600, color: 'var(--text-main)', marginBottom: '2px' }}>
            No Easy Apply questions recorded
          </div>
          <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-subtle)' }}>
            Questions answered during autonomous Easy Apply runs are automatically audited and stored here.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {answers.map((ans, idx) => {
            const confStr = formatConfidence(ans.confidence);
            const isHighConfidence =
              ans.confidence === undefined || ans.confidence === null || ans.confidence >= 0.85;

            return (
              <div
                key={ans.id || idx}
                style={{
                  padding: '12px 14px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  transition: 'border-color 0.15s ease',
                }}
              >
                {/* Question & Type Tag */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '8px',
                    marginBottom: '8px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      lineHeight: '1.35',
                    }}
                  >
                    {ans.question}
                  </span>
                  <div>{getQuestionTypeBadge(ans.question_type)}</div>
                </div>

                {/* Answer Display */}
                <div
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: 'var(--primary)',
                    wordBreak: 'break-word',
                    marginBottom: '8px',
                  }}
                >
                  {ans.answer || '<No Answer Provided>'}
                </div>

                {/* Answer Metadata / Source / Confidence */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    fontSize: '0.75rem',
                    color: 'var(--text-muted)',
                    borderTop: '1px solid var(--border-light)',
                    paddingTop: '6px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Sparkles size={12} color="var(--primary)" />
                    <span>Source: </span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      {ans.answer_source || 'Profile Master / Heuristics'}
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      color: isHighConfidence ? '#15803d' : '#b45309',
                      fontWeight: 600,
                    }}
                  >
                    <ShieldCheck size={12} />
                    <span>{confStr} confidence</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
