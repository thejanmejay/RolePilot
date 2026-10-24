import React, { useEffect, useState } from 'react';
import { FileQuestion, HelpCircle, Sparkles, Database, Loader2 } from 'lucide-react';
import type { Application, ApplicationAnswer } from '../../api/applications';
import { applicationsApi } from '../../api/applications';

interface FormInspectionPanelProps {
  application: Application | null;
}

export const FormInspectionPanel: React.FC<FormInspectionPanelProps> = ({ application }) => {
  const [answers, setAnswers] = useState<ApplicationAnswer[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!application) {
      setAnswers([]);
      return;
    }

    if (application.answers && application.answers.length > 0) {
      setAnswers(application.answers);
      return;
    }

    // Otherwise fetch application details to get answers
    let isMounted = true;
    const fetchAnswers = async () => {
      setIsLoading(true);
      try {
        const fullApp = await applicationsApi.getApplicationById(application.id);
        if (isMounted && fullApp.answers) {
          setAnswers(fullApp.answers);
        }
      } catch (err) {
        console.error('Failed to fetch answers for application', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchAnswers();

    return () => {
      isMounted = false;
    };
  }, [application?.id]);

  if (!application) {
    return (
      <div className="card" style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Select a processed job application from the list above to inspect its form fields and answers.
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: '20px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileQuestion size={18} color="var(--primary)" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
              Form Field & Heuristic Inspector
            </h3>
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Modal questions detected and heuristic answers applied for {application.job?.title || 'Selected Job'}
          </p>
        </div>

        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            padding: '3px 9px',
            borderRadius: 'var(--radius-full)',
            backgroundColor: answers.length > 0 ? 'var(--primary-light)' : 'var(--bg-subtle)',
            color: answers.length > 0 ? 'var(--primary)' : 'var(--text-muted)',
          }}
        >
          {answers.length} Questions Answered
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px', gap: '8px', color: 'var(--text-muted)' }}>
          <Loader2 size={18} className="spin-animation" />
          <span style={{ fontSize: '0.85rem' }}>Loading form answers...</span>
        </div>
      ) : answers.length === 0 ? (
        <div
          style={{
            padding: '24px 16px',
            backgroundColor: '#f8fafc',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            color: 'var(--text-muted)',
            border: '1px dashed var(--border-light)',
          }}
        >
          <HelpCircle size={28} style={{ margin: '0 auto 8px', color: 'var(--text-subtle)' }} />
          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-main)', marginBottom: '4px' }}>
            No Custom Questions Recorded
          </div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0 auto' }}>
            Standard contact info and primary resume were pre-filled directly from candidate profile data without encountering dynamic unmapped fields.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {answers.map((ans, idx) => {
            const confidencePct = ans.confidence ? `${Math.round(ans.confidence * 100)}%` : '95%';
            const sourceDisplay = ans.answer_source || 'Profile Heuristic Engine';

            return (
              <div
                key={ans.id || idx}
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)' }}>
                    {ans.question}
                  </div>

                  {ans.question_type && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        backgroundColor: 'var(--bg-subtle)',
                        color: 'var(--text-muted)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                      }}
                    >
                      {ans.question_type}
                    </span>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '8px 12px',
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Supplied Answer:
                  </span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                    {ans.answer}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Database size={12} />
                    <span>Source: {sourceDisplay}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: 600 }}>
                    <Sparkles size={12} />
                    <span>Confidence: {confidencePct}</span>
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
