import React, { useState, useEffect } from 'react';
import { ShieldCheck, AlertTriangle, Link2Off, RefreshCw, KeyRound, ExternalLink, Loader2 } from 'lucide-react';
import { linkedinApi } from '../../api/linkedin';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';
import type { LinkedInStatus } from '../../types/linkedin';

interface LinkedInStatusCardProps {
  onOpenConnectModal: () => void;
  statusRefreshKey?: number;
}

export const LinkedInStatusCard: React.FC<LinkedInStatusCardProps> = ({
  onOpenConnectModal,
  statusRefreshKey,
}) => {
  const { showSuccess, showError } = useToast();
  const [statusData, setStatusData] = useState<LinkedInStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isDisconnecting, setIsDisconnecting] = useState<boolean>(false);

  const loadStatus = async () => {
    setIsLoading(true);
    try {
      const data = await linkedinApi.getStatus();
      setStatusData(data);
    } catch (err) {
      // In case of network error, keep default
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [statusRefreshKey]);

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect LinkedIn and wipe stored session credentials?')) {
      return;
    }

    setIsDisconnecting(true);
    try {
      await linkedinApi.disconnect();
      showSuccess('LinkedIn session disconnected successfully.');
      await loadStatus();
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsDisconnecting(false);
    }
  };

  const isConnected = statusData?.is_connected && statusData?.status === 'connected';
  const isExpired = statusData?.status === 'expired';

  return (
    <div className="card" style={{ padding: '18px 20px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                backgroundColor: '#0A66C2',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '1.1rem',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              in
            </div>
            <div>
              <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-main)' }}>
                LinkedIn Connection
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Session credentials for automated Easy Apply
              </div>
            </div>
          </div>

          {/* Status Badge */}
          {isLoading ? (
            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Checking...</span>
          ) : isConnected ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#16A34A',
                backgroundColor: '#DCFCE7',
                padding: '4px 10px',
                borderRadius: '9999px',
              }}
            >
              <ShieldCheck size={14} />
              <span>Connected</span>
            </div>
          ) : isExpired ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#D97706',
                backgroundColor: '#FEF3C7',
                padding: '4px 10px',
                borderRadius: '9999px',
              }}
            >
              <AlertTriangle size={14} />
              <span>Session Expired</span>
            </div>
          ) : (
            <div
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#64748B',
                backgroundColor: '#F1F5F9',
                padding: '4px 10px',
                borderRadius: '9999px',
              }}
            >
              Not Connected
            </div>
          )}
        </div>

        {/* Informational description */}
        <p style={{ margin: '0 0 14px 0', fontSize: '0.84rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>
          {isConnected
            ? 'Your LinkedIn session is verified and active. Autonomous job search and qualification evaluations will run using your authenticated candidate session.'
            : isExpired
            ? 'Your LinkedIn session credentials have expired. Please reconnect to resume automated job applications and qualification discovery.'
            : 'Connect your LinkedIn session to enable autonomous job search, qualification evaluation, and pre-staged Easy Apply questionnaires.'}
        </p>

        {statusData?.linkedin_profile_url && (
          <div style={{ marginBottom: '12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Profile:</span>
            <a
              href={statusData.linkedin_profile_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#0A66C2', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: '3px' }}
            >
              <span>{statusData.linkedin_profile_url.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '')}</span>
              <ExternalLink size={12} />
            </a>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '10px' }}>
        {isConnected ? (
          <>
            <button
              type="button"
              onClick={onOpenConnectModal}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: '8px' }}
            >
              <RefreshCw size={13} style={{ marginRight: '6px' }} />
              <span>Update Session</span>
            </button>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
              className="btn btn-secondary"
              style={{ fontSize: '0.82rem', padding: '6px 14px', borderRadius: '8px', color: '#DC2626' }}
            >
              {isDisconnecting ? <Loader2 size={13} className="spin-animation" /> : <Link2Off size={13} style={{ marginRight: '6px' }} />}
              <span>Disconnect</span>
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onOpenConnectModal}
            className="btn btn-primary"
            style={{ fontSize: '0.84rem', padding: '7px 16px', borderRadius: '8px' }}
          >
            <KeyRound size={14} style={{ marginRight: '6px' }} />
            <span>{isExpired ? 'Reconnect LinkedIn' : 'Connect LinkedIn'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
