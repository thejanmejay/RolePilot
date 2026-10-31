import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Link2Off,
  RefreshCw,
  KeyRound,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { linkedinApi } from '../../api/linkedin';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';
import type { LinkedInStatus } from '../../types/linkedin';
import { PLATFORM_CATALOG, type PlatformConfig } from '../../types/platform';
import { Badge } from '../common/Badge';

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
  const [showConfirmDisconnect, setShowConfirmDisconnect] = useState<boolean>(false);

  const linkedinConfig = PLATFORM_CATALOG.find((p) => p.id === 'linkedin') as PlatformConfig;

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
    setIsDisconnecting(true);
    try {
      await linkedinApi.disconnect();
      showSuccess('LinkedIn session credentials wiped and disconnected successfully.');
      setShowConfirmDisconnect(false);
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
    <div
      className="card platform-connection-card"
      style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid var(--border, #E5E7EB)',
        padding: '20px 22px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}
    >
      <div>
        {/* Platform Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                backgroundColor: '#0A66C2',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '1.2rem',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                flexShrink: 0,
              }}
            >
              in
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-main, #111827)' }}>
                  LinkedIn Integration
                </span>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    backgroundColor: '#E0F2FE',
                    color: '#0369A1',
                    padding: '2px 7px',
                    borderRadius: '4px',
                  }}
                >
                  Active Platform
                </span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748B)' }}>
                {linkedinConfig.tagline}
              </div>
            </div>
          </div>

          {/* Status Badge */}
          {isLoading ? (
            <span style={{ fontSize: '0.78rem', color: '#64748B' }}>Checking...</span>
          ) : isConnected ? (
            <Badge variant="success" size="md">
              <ShieldCheck size={13} style={{ marginRight: '4px' }} />
              Connected
            </Badge>
          ) : isExpired ? (
            <Badge variant="warning" size="md">
              <AlertTriangle size={13} style={{ marginRight: '4px' }} />
              Session Expired
            </Badge>
          ) : (
            <Badge variant="neutral" size="md">
              Not Connected
            </Badge>
          )}
        </div>

        {/* Informational description */}
        <p
          style={{
            margin: '0 0 12px 0',
            fontSize: '0.84rem',
            color: 'var(--text-muted, #64748B)',
            lineHeight: 1.5,
          }}
        >
          {isConnected
            ? 'Your authenticated session is active and encrypted at rest with AES-256. Headless browser automation uses this session for autonomous Easy Apply submissions.'
            : isExpired
            ? 'Your LinkedIn session token has expired or was revoked. Reconnect using a fresh li_at session cookie to resume autonomous application processing.'
            : 'Connect your LinkedIn session token to enable autonomous Easy Apply submission, form question answering, and qualification screening.'}
        </p>

        {/* Profile URL Link if available */}
        {statusData?.linkedin_profile_url && (
          <div style={{ marginBottom: '10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: 'var(--text-muted, #64748B)' }}>Connected Profile:</span>
            <a
              href={statusData.linkedin_profile_url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#0A66C2',
                fontWeight: 600,
                textDecoration: 'underline',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
              }}
            >
              <span>{statusData.linkedin_profile_url.replace(/https?:\/\/(www\.)?linkedin\.com\/in\//, '')}</span>
              <ExternalLink size={11} />
            </a>
          </div>
        )}

        {/* Platform Capabilities Breakdown */}
        <div
          style={{
            backgroundColor: '#F8FAFC',
            border: '1px solid var(--border-light, #E2E8F0)',
            borderRadius: '8px',
            padding: '10px 12px',
          }}
        >
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted, #64748B)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '6px' }}>
            Supported Capabilities
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', color: '#166534', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <CheckCircle2 size={12} />
              Easy Apply Automation
            </span>
            <span style={{ fontSize: '0.72rem', color: '#166534', backgroundColor: '#DCFCE7', padding: '2px 8px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600 }}>
              <CheckCircle2 size={12} />
              Job Discovery
            </span>
            <span style={{ fontSize: '0.72rem', color: '#64748B', backgroundColor: '#F1F5F9', padding: '2px 8px', borderRadius: '4px', fontWeight: 500 }}>
              External ATS (Manual)
            </span>
          </div>
        </div>

        {/* Destructive Disconnect Confirmation Modal/Banner */}
        {showConfirmDisconnect && (
          <div
            style={{
              padding: '12px 14px',
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '8px',
              marginTop: '10px',
            }}
          >
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#B91C1C', marginBottom: '4px' }}>
              Disconnect LinkedIn Session?
            </div>
            <p style={{ fontSize: '0.75rem', color: '#7F1D1D', margin: '0 0 10px 0', lineHeight: 1.4 }}>
              This will permanently wipe the encrypted <code>li_at</code> session credentials from RolePilot’s server. Any scheduled or queued automation runs will stop until you reconnect.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  color: '#FFFFFF',
                  backgroundColor: '#DC2626',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isDisconnecting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                {isDisconnecting ? <Loader2 size={12} className="spin-animation" /> : <Link2Off size={12} />}
                <span>Confirm Disconnect</span>
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmDisconnect(false)}
                disabled={isDisconnecting}
                style={{
                  padding: '6px 12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: '#475569',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  borderRadius: '6px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={{ marginTop: '2px' }}>
        {isConnected ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
            <button
              type="button"
              onClick={onOpenConnectModal}
              className="btn btn-secondary"
              style={{
                flex: 1,
                fontSize: '0.84rem',
                padding: '10px 14px',
                borderRadius: '8px',
                minHeight: '40px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              <RefreshCw size={14} />
              <span>Replace / Update Session</span>
            </button>
            <button
              type="button"
              onClick={() => setShowConfirmDisconnect(true)}
              disabled={isDisconnecting || showConfirmDisconnect}
              className="btn btn-secondary"
              style={{
                fontSize: '0.84rem',
                padding: '10px 14px',
                borderRadius: '8px',
                minHeight: '40px',
                color: '#DC2626',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
            >
              <Link2Off size={14} />
              <span>Disconnect</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenConnectModal}
            className="btn btn-primary"
            style={{
              width: '100%',
              fontSize: '0.88rem',
              fontWeight: 700,
              padding: '11px 16px',
              borderRadius: '8px',
              minHeight: '42px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              backgroundColor: '#0A66C2',
              color: '#FFFFFF',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 1px 3px rgba(10, 102, 194, 0.25)',
              transition: 'background-color 0.15s ease',
            }}
          >
            <KeyRound size={16} />
            <span>{isExpired ? 'Reconnect LinkedIn' : 'Connect LinkedIn'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
