import React, { useState } from 'react';
import { Key, LogIn, AlertCircle, Sparkles, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { login } = useAuth();
  const { showSuccess, showError } = useToast();
  const [tokenInput, setTokenInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTokenLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = tokenInput.trim();
    if (!trimmed) {
      setError('Please paste your Supabase user access token.');
      return;
    }

    if (!trimmed.startsWith('eyJ')) {
      setError('Invalid JWT format. Token must start with "eyJ".');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      login(trimmed);
      showSuccess('Session authenticated successfully!');
      if (onClose) onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to authenticate token.');
      showError('Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 3000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: '520px', margin: 'auto', alignSelf: 'center' }}>
        <div className="modal-header" style={{ backgroundColor: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                backgroundColor: 'var(--primary)',
                color: '#ffffff',
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Key size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                RolePilot Authentication
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, marginTop: '2px' }}>
                Connect to FastAPI & Supabase SaaS backend
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="modal-close-btn"
              aria-label="Close dialog"
              title="Close"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '34px',
                height: '34px',
                minWidth: '34px',
                minHeight: '34px',
                borderRadius: '50%',
                border: '1px solid var(--border-light)',
                backgroundColor: '#ffffff',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)',
                flexShrink: 0,
              }}
            >
              <X size={18} strokeWidth={2.2} />
            </button>
          )}
        </div>

        <div className="modal-body">
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
            To view and edit your profile securely, paste your authenticated Supabase user access token.
          </p>

          {import.meta.env.DEV && (
            <div
              style={{
                backgroundColor: 'var(--primary-light)',
                border: '1px solid var(--primary-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                fontSize: '0.8rem',
                color: 'var(--primary-hover)',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
              }}
            >
              <Sparkles size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Quick command to get your user token:</strong>
                <code
                  style={{
                    display: 'block',
                    backgroundColor: '#ffffff',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    marginTop: '6px',
                    fontFamily: 'monospace',
                    color: 'var(--text-main)',
                    border: '1px solid #cbd5e1',
                    userSelect: 'all',
                  }}
                >
                  ./linkedin-hunter/.venv/bin/python scripts/get_test_token.py
                </code>
              </div>
            </div>
          )}

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

          <form onSubmit={handleTokenLogin}>
            <div className="form-group">
              <label className="form-label">User Access Token (JWT) *</label>
              <textarea
                rows={4}
                required
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="form-textarea"
                placeholder="eyJhbGciOiJFUzI1NiIs..."
                style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                autoFocus
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px', marginTop: '8px' }}
              disabled={isSubmitting}
            >
              <LogIn size={16} />
              <span>{isSubmitting ? 'Authenticating...' : 'Sign In & Load Profile'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
