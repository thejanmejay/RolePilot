import React, { useState, useEffect } from 'react';
import { Check, AlertCircle, Bookmark, Send, CalendarCheck, Award, XCircle, Ban } from 'lucide-react';
import { Modal } from '../Modal';
import { applicationsApi, type Application } from '../../api/applications';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';

interface ApplicationStatusModalProps {
  application: Application | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdated: (updated: Application) => void;
}

export const ApplicationStatusModal: React.FC<ApplicationStatusModalProps> = ({
  application,
  isOpen,
  onClose,
  onStatusUpdated,
}) => {
  const { showSuccess, showError } = useToast();
  const [status, setStatus] = useState<string>(application?.status || 'applied');
  const [appUrl, setAppUrl] = useState<string>(application?.application_url || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when application changes
  useEffect(() => {
    if (application) {
      setStatus(application.status || 'applied');
      setAppUrl(application.application_url || '');
      setError(null);
    }
  }, [application]);

  if (!application) return null;

  const statusOptions = [
    { value: 'saved', label: 'Saved Shortlist', icon: Bookmark, color: '#475569', bg: '#f1f5f9' },
    { value: 'applied', label: 'Applied (Submitted)', icon: Send, color: '#0284c7', bg: '#e0f2fe' },
    { value: 'interviewing', label: 'Interviewing', icon: CalendarCheck, color: '#d97706', bg: '#fef3c7' },
    { value: 'offer', label: 'Offer Received', icon: Award, color: '#16a34a', bg: '#dcfce7' },
    { value: 'rejected', label: 'Rejected / Not Selected', icon: XCircle, color: '#dc2626', bg: '#fee2e2' },
    { value: 'withdrawn', label: 'Withdrawn', icon: Ban, color: '#64748b', bg: '#f8fafc' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const updated = await applicationsApi.updateApplicationStatus(
        application.id,
        status,
        appUrl || undefined
      );
      showSuccess(`Status updated to ${status.toUpperCase()}!`);
      onStatusUpdated(updated);
      onClose();
    } catch (err) {
      const msg = formatErrorMessage(err);
      setError(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Update Application Pipeline Status">
      <form onSubmit={handleSubmit}>
        {/* Job snapshot */}
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            border: '1px solid var(--border-color)',
          }}
        >
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
            {application.job?.title || 'Job Application'}
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {application.job?.company || 'Company'} {application.job?.location ? `• ${application.job.location}` : ''}
          </div>
        </div>

        {error && (
          <div
            style={{
              backgroundColor: 'var(--danger-bg)',
              color: 'var(--danger)',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              marginBottom: '16px',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Quick status selector chips */}
        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label className="form-label" style={{ fontWeight: 600, marginBottom: '8px', display: 'block' }}>
            Select Pipeline Stage *
          </label>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '8px',
            }}
          >
            {statusOptions.map((opt) => {
              const Icon = opt.icon;
              const isCurrent = status === opt.value;
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '10px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: isCurrent ? `2px solid ${opt.color}` : '1px solid var(--border-color)',
                    backgroundColor: isCurrent ? opt.bg : '#ffffff',
                    color: isCurrent ? opt.color : 'var(--text-main)',
                    fontWeight: isCurrent ? 700 : 500,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.1s ease',
                    minHeight: '44px',
                  }}
                >
                  <Icon size={14} style={{ color: opt.color, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {opt.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* URL field */}
        <div className="form-group" style={{ marginBottom: '20px' }}>
          <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600 }}>
            Application / LinkedIn URL (Optional)
          </label>
          <input
            type="url"
            value={appUrl}
            onChange={(e) => setAppUrl(e.target.value)}
            placeholder="https://www.linkedin.com/jobs/view/..."
            className="form-input"
            disabled={isSubmitting}
            style={{ height: '40px', fontSize: '0.85rem' }}
          />
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            disabled={isSubmitting}
            style={{ minHeight: '40px', padding: '0 16px' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
            style={{ minHeight: '40px', padding: '0 18px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Check size={16} />
            <span>{isSubmitting ? 'Saving...' : 'Confirm Status'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
