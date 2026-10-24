import React, { useState } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Modal } from '../Modal';
import { applicationsApi, type Application } from '../../api/applications';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';

interface DeleteApplicationModalProps {
  application: Application | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

export const DeleteApplicationModal: React.FC<DeleteApplicationModalProps> = ({
  application,
  isOpen,
  onClose,
  onDeleted,
}) => {
  const { showSuccess, showError } = useToast();
  const [isDeleting, setIsDeleting] = useState(false);

  if (!application) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await applicationsApi.deleteApplication(application.id);
      showSuccess('Application removed from tracker.');
      onDeleted(application.id);
      onClose();
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Remove Application">
      <div style={{ padding: '8px 0' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            backgroundColor: 'var(--danger-bg)',
            color: 'var(--danger)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
          }}
        >
          <AlertTriangle size={24} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Remove this application?</div>
            <div style={{ fontSize: '0.8rem', marginTop: '2px', opacity: 0.9 }}>
              This will remove the application record from your tracker.
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '8px' }}>
          <strong>Job:</strong> {application.job?.title || 'Unknown Title'}
        </div>
        <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
          <strong>Company:</strong> {application.job?.company || 'Unknown Company'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isDeleting}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="btn"
            style={{
              backgroundColor: 'var(--danger)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            disabled={isDeleting}
          >
            <Trash2 size={16} />
            <span>{isDeleting ? 'Removing...' : 'Remove'}</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
