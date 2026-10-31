import React, { useState } from 'react';
import {
  Check,
  ArrowRight,
  User,
} from 'lucide-react';
import { Modal } from '../Modal';
import type { ProfileDraftData } from './ReviewProfileStep';

export interface CompleteStepProps {
  draft: ProfileDraftData;
  onGoToDashboard: () => void;
  resumeFileName?: string | null;
}

export const CompleteStep: React.FC<CompleteStepProps> = ({
  draft,
  onGoToDashboard,
  resumeFileName,
}) => {
  const [showResumeModal, setShowResumeModal] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '24px 20px',
        maxWidth: '560px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Celebration Avatar with Green Checkmark Badge and Confetti */}
      <div
        style={{
          position: 'relative',
          width: '180px',
          height: '180px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '24px',
        }}
      >
        {/* Floating Confetti Shapes */}
        <div style={{ position: 'absolute', top: '16px', left: '16px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#EF4444' }} />
        <div style={{ position: 'absolute', top: '28px', right: '24px', width: '10px', height: '4px', backgroundColor: '#3B82F6', transform: 'rotate(45deg)' }} />
        <div style={{ position: 'absolute', bottom: '24px', left: '20px', width: '6px', height: '12px', backgroundColor: '#10B981', transform: 'rotate(25deg)' }} />
        <div style={{ position: 'absolute', bottom: '16px', right: '32px', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
        <div style={{ position: 'absolute', top: '70px', left: '6px', width: '8px', height: '4px', backgroundColor: '#8B5CF6', transform: 'rotate(-30deg)' }} />
        <div style={{ position: 'absolute', top: '65px', right: '8px', width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#06B6D4' }} />

        {/* Circular Light Blue Base */}
        <div
          style={{
            width: '130px',
            height: '130px',
            borderRadius: '50%',
            backgroundColor: '#EFF6FF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '4px solid #DBEAFE',
          }}
        >
          {/* Avatar Profile Silhouette */}
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              backgroundColor: '#CBD5E1',
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '1.8rem',
              overflow: 'hidden',
            }}
          >
            {draft.fullName ? draft.fullName.slice(0, 2).toUpperCase() : <User size={44} />}
          </div>
        </div>

        {/* Green Checkmark Badge at Top Right */}
        <div
          style={{
            position: 'absolute',
            top: '22px',
            right: '24px',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            backgroundColor: '#16A34A',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '3px solid #FFFFFF',
            boxShadow: '0 4px 10px rgba(22, 163, 74, 0.25)',
          }}
        >
          <Check size={20} strokeWidth={3} />
        </div>
      </div>

      {/* Heading & Subtitle */}
      <h1
        style={{
          fontSize: '1.95rem',
          fontWeight: 800,
          color: '#101A3A',
          margin: '0 0 10px 0',
          letterSpacing: '-0.02em',
        }}
      >
        Your profile is ready!
      </h1>
      <p
        style={{
          fontSize: '0.98rem',
          color: '#64748B',
          lineHeight: 1.55,
          maxWidth: '440px',
          margin: '0 0 28px 0',
        }}
      >
        We've successfully created your profile and saved your preferences. You can now start exploring job opportunities.
      </p>

      {/* Buttons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', maxWidth: '340px' }}>
        <button
          type="button"
          onClick={onGoToDashboard}
          className="btn btn-primary"
          style={{
            height: '48px',
            padding: '0 24px',
            fontSize: '0.96rem',
            fontWeight: 700,
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: '#1769E8',
            color: '#FFFFFF',
            width: '100%',
          }}
        >
          <span>Go to Dashboard</span>
          <ArrowRight size={18} />
        </button>

        <button
          type="button"
          onClick={() => setShowResumeModal(true)}
          className="btn btn-outline"
          style={{
            height: '44px',
            padding: '0 24px',
            fontSize: '0.9rem',
            fontWeight: 600,
            borderRadius: '10px',
            borderColor: '#CBD5E1',
            color: '#1E293B',
            backgroundColor: '#FFFFFF',
            width: '100%',
          }}
        >
          View My Resume
        </button>
      </div>

      {/* Resume Preview Modal */}
      <Modal
        isOpen={showResumeModal}
        onClose={() => setShowResumeModal(false)}
        title="Candidate Profile Summary"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#101A3A', margin: 0 }}>
              {draft.fullName || 'Candidate'}
            </h3>
            <div style={{ fontSize: '0.86rem', color: '#1769E8', fontWeight: 600, marginTop: '2px' }}>
              {draft.headline || 'Software Engineer'}
            </div>
            {(draft.city || draft.country) && (
              <div style={{ fontSize: '0.8rem', color: '#64748B', marginTop: '2px' }}>
                {[draft.city, draft.country].filter(Boolean).join(', ')}
              </div>
            )}
          </div>

          {draft.about && (
            <div>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '4px' }}>
                Summary
              </h4>
              <p style={{ fontSize: '0.86rem', color: '#334155', lineHeight: 1.5, margin: 0 }}>
                {draft.about}
              </p>
            </div>
          )}

          {draft.skills.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '6px' }}>
                Skills ({draft.skills.length})
              </h4>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {draft.skills.map((s, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: '#EFF6FF',
                      border: '1px solid #BFDBFE',
                      borderRadius: '6px',
                      fontSize: '0.78rem',
                      color: '#1E40AF',
                      fontWeight: 600,
                    }}
                  >
                    {s.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {draft.experiences.length > 0 && (
            <div>
              <h4 style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748B', marginBottom: '6px' }}>
                Work History
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {draft.experiences.map((exp, idx) => (
                  <div key={idx} style={{ fontSize: '0.84rem' }}>
                    <div style={{ fontWeight: 700, color: '#101A3A' }}>
                      {exp.job_title} at {exp.company_name}
                    </div>
                    {exp.description && (
                      <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                        {exp.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {resumeFileName && (
            <div style={{ fontSize: '0.78rem', color: '#64748B', borderTop: '1px solid #E2E8F0', paddingTop: '10px' }}>
              Extracted from: <strong>{resumeFileName}</strong>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '12px' }}>
            <button
              type="button"
              onClick={() => setShowResumeModal(false)}
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
