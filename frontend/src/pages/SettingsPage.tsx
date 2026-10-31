import React, { useState, useEffect, useCallback } from 'react';
import {
  User,
  Shield,
  Link2,
  Bell,
  Activity,
  FileText,
  AlertTriangle,
  Lock,
  LogOut,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Database,
  Cpu,
  KeyRound,
  Eye,
  EyeOff,
  HelpCircle,
  Calendar,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authService } from '../services/authService';
import { linkedinApi } from '../api/linkedin';
import { formatErrorMessage } from '../api/client';
import { Modal } from '../components/Modal';
import { Badge } from '../components/common/Badge';
import { LinkedInConsentModal } from '../components/linkedin/LinkedInConsentModal';
import type { LinkedInStatus } from '../types/linkedin';

export type SettingsSection =
  | 'account'
  | 'security'
  | 'connections'
  | 'preferences'
  | 'system'
  | 'legal'
  | 'danger';

interface SettingsPageProps {
  initialSection?: SettingsSection;
  onNavigateProfile?: () => void;
  onNavigateSupport?: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  onNavigateGuidelines?: () => void;
  onNavigateTab?: (tab: 'dashboard' | 'profile' | 'jobs' | 'applications' | 'automation') => void;
}

interface HealthDiagnostics {
  status: string;
  service: string;
  environment: string;
  database: string;
  session_encryption: {
    configured: boolean;
    required_in_production: boolean;
  };
  browser_engine: {
    status: string;
    chromium_available: boolean;
    executable_path?: string | null;
    version?: string | null;
    notes?: string;
  };
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  initialSection = 'account',
  onNavigateProfile,
  onNavigateSupport,
  onNavigateTerms,
  onNavigatePrivacy,
  onNavigateGuidelines,
  onNavigateTab,
}) => {
  const { email, logout } = useAuth();
  const { showSuccess, showError, showWarning } = useToast();

  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);

  // Security - Password Change State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [passwordStatusMsg, setPasswordStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Connected Accounts - LinkedIn State
  const [linkedinStatus, setLinkedinStatus] = useState<LinkedInStatus | null>(null);
  const [isLoadingLinkedin, setIsLoadingLinkedin] = useState(false);
  const [isDisconnectingLinkedin, setIsDisconnectingLinkedin] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);

  // Preferences State
  const [toastAlerts, setToastAlerts] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rolepilot_pref_toasts') !== 'false';
    } catch {
      return true;
    }
  });
  const [appAlerts, setAppAlerts] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rolepilot_pref_app_alerts') !== 'false';
    } catch {
      return true;
    }
  });
  const [detailedTelemetry, setDetailedTelemetry] = useState<boolean>(() => {
    try {
      return localStorage.getItem('rolepilot_pref_telemetry') === 'true';
    } catch {
      return false;
    }
  });

  // System Status State
  const [healthData, setHealthData] = useState<HealthDiagnostics | null>(null);
  const [healthLatencyMs, setHealthLatencyMs] = useState<number | null>(null);
  const [isLoadingHealth, setIsLoadingHealth] = useState(false);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [lastHealthChecked, setLastHealthChecked] = useState<Date | null>(null);

  // Danger Zone - Delete Account State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);

  // Fetch LinkedIn Connection Status
  const fetchLinkedinStatus = useCallback(async () => {
    setIsLoadingLinkedin(true);
    try {
      const data = await linkedinApi.getStatus();
      setLinkedinStatus(data);
    } catch {
      // Offline fallback: keep existing
    } finally {
      setIsLoadingLinkedin(false);
    }
  }, []);

  // Fetch Live System Health
  const fetchHealth = useCallback(async () => {
    setIsLoadingHealth(true);
    setHealthError(null);
    const startTime = performance.now();
    try {
      const res = await fetch('/health/diagnostics');
      const endTime = performance.now();
      setHealthLatencyMs(Math.round(endTime - startTime));
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: Failed to retrieve service diagnostics.`);
      }
      const data = (await res.json()) as HealthDiagnostics;
      setHealthData(data);
      setLastHealthChecked(new Date());
    } catch (err: any) {
      setHealthError(err.message || 'Could not connect to RolePilot API diagnostic endpoint.');
      setHealthData(null);
    } finally {
      setIsLoadingHealth(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'connections') {
      fetchLinkedinStatus();
    } else if (activeSection === 'system') {
      fetchHealth();
    }
  }, [activeSection, fetchLinkedinStatus, fetchHealth]);

  // Handle Password Update
  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordStatusMsg(null);

    if (newPassword.length < 8) {
      setPasswordStatusMsg({ type: 'error', text: 'Password must be at least 8 characters long.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatusMsg({ type: 'error', text: 'Passwords do not match.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const result = await authService.updatePassword(newPassword);
      if (!result.success) {
        setPasswordStatusMsg({ type: 'error', text: result.error || 'Failed to update password.' });
      } else {
        setPasswordStatusMsg({ type: 'success', text: 'Password updated successfully!' });
        setNewPassword('');
        setConfirmPassword('');
        showSuccess('Your account password has been updated.');
      }
    } catch (err: any) {
      setPasswordStatusMsg({ type: 'error', text: err.message || 'Failed to update password.' });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Handle LinkedIn Disconnect
  const handleDisconnectLinkedin = async () => {
    setIsDisconnectingLinkedin(true);
    try {
      await linkedinApi.disconnect();
      showSuccess('LinkedIn account disconnected and session credentials wiped.');
      setShowDisconnectConfirm(false);
      await fetchLinkedinStatus();
    } catch (err: any) {
      showError(formatErrorMessage(err));
    } finally {
      setIsDisconnectingLinkedin(false);
    }
  };

  // Handle Save Preferences
  const handleSavePreferences = () => {
    try {
      localStorage.setItem('rolepilot_pref_toasts', toastAlerts ? 'true' : 'false');
      localStorage.setItem('rolepilot_pref_app_alerts', appAlerts ? 'true' : 'false');
      localStorage.setItem('rolepilot_pref_telemetry', detailedTelemetry ? 'true' : 'false');
      showSuccess('Settings and notification preferences saved.');
    } catch {
      showWarning('Unable to save preferences to local storage.');
    }
  };

  // Handle Account Deletion
  const handleDeleteAccount = async () => {
    if (deleteConfirmationInput !== 'DELETE' || isDeletingAccount) return;
    setIsDeletingAccount(true);
    setDeleteAccountError(null);

    try {
      await authService.deleteAccount();
      await logout();
      setIsDeleteModalOpen(false);

      if (onNavigateSupport) {
        onNavigateSupport();
      } else {
        window.location.href = '/support';
      }
    } catch (err: any) {
      setDeleteAccountError(formatErrorMessage(err));
      setIsDeletingAccount(false);
    }
  };

  const userInitials = email ? email.substring(0, 2).toUpperCase() : 'RP';

  const sectionsList = [
    { id: 'account' as SettingsSection, label: 'Account & Profile', icon: User },
    { id: 'security' as SettingsSection, label: 'Security & Sessions', icon: Shield },
    { id: 'connections' as SettingsSection, label: 'Connected Accounts', icon: Link2 },
    { id: 'preferences' as SettingsSection, label: 'Preferences & Notifications', icon: Bell },
    { id: 'system' as SettingsSection, label: 'System Status', icon: Activity },
    { id: 'legal' as SettingsSection, label: 'Legal & Support', icon: FileText },
    { id: 'danger' as SettingsSection, label: 'Danger Zone', icon: AlertTriangle, isDanger: true },
  ];

  return (
    <div className="settings-page-wrapper" style={{ padding: '24px 16px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.65rem', fontWeight: 800, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
          Settings &amp; System Status
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
          Manage your account profile, security credentials, connected integrations, notification preferences, and system diagnostics.
        </p>
      </div>

      {/* Main Grid: Left Tabs / Nav, Right Content */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 260px) 1fr',
          gap: '24px',
          alignItems: 'start',
        }}
        className="settings-grid-layout"
      >
        {/* Navigation Sidebar */}
        <aside
          role="tablist"
          aria-label="Settings Sections"
          style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
            padding: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            boxShadow: 'var(--shadow-sm)',
          }}
          className="settings-nav-pane"
        >
          {sectionsList.map((sec) => {
            const Icon = sec.icon;
            const isActive = activeSection === sec.id;
            return (
              <button
                key={sec.id}
                role="tab"
                id={`settings-tab-${sec.id}`}
                aria-selected={isActive}
                aria-controls={`settings-panel-${sec.id}`}
                onClick={() => setActiveSection(sec.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  backgroundColor: isActive
                    ? sec.isDanger
                      ? 'rgba(239, 68, 68, 0.1)'
                      : 'var(--primary-subtle, rgba(37, 99, 235, 0.08))'
                    : 'transparent',
                  color: isActive
                    ? sec.isDanger
                      ? 'var(--danger)'
                      : 'var(--primary)'
                    : sec.isDanger
                    ? 'var(--danger)'
                    : 'var(--text-main)',
                  fontWeight: isActive ? 700 : 500,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                  width: '100%',
                }}
              >
                <Icon size={17} style={{ flexShrink: 0 }} />
                <span>{sec.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Content Pane */}
        <main
          role="tabpanel"
          id={`settings-panel-${activeSection}`}
          aria-labelledby={`settings-tab-${activeSection}`}
          style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-light)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          {/* SECTION 1: ACCOUNT & PROFILE */}
          {activeSection === 'account' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                  Account &amp; Profile
                </h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Your primary authentication identity and candidate profile details.
                </p>
              </div>

              {/* Identity Card */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#f8fafc',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                }}
              >
                <div
                  className="avatar-circle"
                  style={{
                    width: '54px',
                    height: '54px',
                    fontSize: '1.3rem',
                    backgroundColor: 'var(--primary)',
                    color: '#ffffff',
                    fontWeight: 800,
                  }}
                >
                  {userInitials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {email || 'Authenticated User'}
                    </span>
                    <Badge variant="success">Verified Identity</Badge>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={13} /> Active Supabase Auth Account
                    </span>
                  </div>
                </div>
              </div>

              {/* Profile Link Card */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text-main)', marginBottom: '4px' }}>
                    Full Candidate Profile &amp; Resume
                  </div>
                  <div style={{ fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Manage your target roles, skills, work experiences, education history, and ATS-optimized resume files.
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (onNavigateProfile) onNavigateProfile();
                    else if (onNavigateTab) onNavigateTab('profile');
                  }}
                  className="btn btn-primary"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Go to Profile Page
                </button>
              </div>

              {/* Data Privacy Notice */}
              <div
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'rgba(37, 99, 235, 0.05)',
                  border: '1px solid rgba(37, 99, 235, 0.15)',
                  fontSize: '0.85rem',
                  color: 'var(--text-main)',
                  lineHeight: 1.5,
                }}
              >
                <strong>Candidate Data Protection:</strong> All profile records, resumes, and answers are isolated to your account. RolePilot never uses your personal candidate data to train external AI models without separate explicit authorization.
              </div>
            </div>
          )}

          {/* SECTION 2: SECURITY & SESSIONS */}
          {activeSection === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                  Security &amp; Sessions
                </h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Manage your authentication password, encryption status, and active browser sessions.
                </p>
              </div>

              {/* Password Management Form */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <Lock size={18} color="var(--primary)" />
                  <span style={{ fontWeight: 700, fontSize: '0.98rem' }}>Change Account Password</span>
                </div>

                {passwordStatusMsg && (
                  <div
                    role="alert"
                    className={`auth-alert ${passwordStatusMsg.type === 'success' ? 'auth-alert-success' : 'auth-alert-error'}`}
                    style={{ marginBottom: '16px' }}
                  >
                    {passwordStatusMsg.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span>{passwordStatusMsg.text}</span>
                  </div>
                )}

                <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '440px' }}>
                  <div>
                    <label htmlFor="settings-new-password" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      New Password (minimum 8 characters)
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="settings-new-password"
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="form-input"
                        autoComplete="new-password"
                        required
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{
                          position: 'absolute',
                          right: '10px',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          color: 'var(--text-muted)',
                        }}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="settings-confirm-password" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px' }}>
                      Confirm New Password
                    </label>
                    <input
                      id="settings-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="form-input"
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  <div style={{ marginTop: '4px' }}>
                    <button
                      type="submit"
                      disabled={isUpdatingPassword || !newPassword || !confirmPassword}
                      className="btn btn-primary"
                    >
                      {isUpdatingPassword ? (
                        <>
                          <Loader2 size={15} className="spinner" />
                          <span>Updating Password…</span>
                        </>
                      ) : (
                        'Update Password'
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* Active Sessions & Sign Out */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.96rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Shield size={17} color="var(--success)" />
                    <span>Active Supabase Auth Session</span>
                  </div>
                  <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Signed in as {email}. Session tokens refresh automatically.
                  </div>
                </div>
                <button
                  onClick={async () => {
                    await logout();
                    window.location.href = '/';
                  }}
                  className="btn btn-outline"
                  style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}

          {/* SECTION 3: CONNECTED ACCOUNTS */}
          {activeSection === 'connections' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                  Connected Accounts
                </h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Manage authenticated job portal sessions and automation credentials.
                </p>
              </div>

              {/* LinkedIn Status Card */}
              <div
                style={{
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-light)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: 'var(--radius-md)',
                        backgroundColor: '#0A66C2',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 800,
                        fontSize: '1.1rem',
                      }}
                    >
                      in
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-main)' }}>LinkedIn</div>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Automated job search, extraction, and Easy Apply integration.
                      </div>
                    </div>
                  </div>

                  <div>
                    {isLoadingLinkedin ? (
                      <Badge variant="neutral">Checking status…</Badge>
                    ) : linkedinStatus?.is_connected ? (
                      <Badge variant="success">Connected &amp; Active</Badge>
                    ) : (
                      <Badge variant="neutral">Not Connected</Badge>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    backgroundColor: '#f8fafc',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-light)',
                    fontSize: '0.84rem',
                    color: 'var(--text-muted)',
                    marginBottom: '16px',
                    lineHeight: 1.5,
                  }}
                >
                  <KeyRound size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                  Session tokens are encrypted using server-side AES-256 Fernet keys and never stored in client browser storage.
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {linkedinStatus?.is_connected ? (
                    <>
                      <button
                        onClick={() => setShowConnectModal(true)}
                        className="btn btn-secondary"
                        style={{ fontSize: '0.86rem' }}
                      >
                        Update Session Token
                      </button>
                      <button
                        onClick={() => setShowDisconnectConfirm(true)}
                        className="btn btn-outline"
                        style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)', fontSize: '0.86rem' }}
                      >
                        Disconnect Account
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setShowConnectModal(true)}
                      className="btn btn-primary"
                      style={{ fontSize: '0.86rem' }}
                    >
                      Connect LinkedIn
                    </button>
                  )}
                </div>
              </div>

              {/* Other Platforms Catalog Preview */}
              <div>
                <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>
                  Upcoming Platform Integrations
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                  {[
                    { name: 'Indeed', desc: 'Direct application automation' },
                    { name: 'Glassdoor', desc: 'Salary insights & portal sync' },
                    { name: 'ZipRecruiter', desc: 'One-click application flow' },
                    { name: 'Greenhouse', desc: 'Direct ATS pipeline submission' },
                  ].map((p) => (
                    <div
                      key={p.name}
                      style={{
                        padding: '14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px dashed var(--border-light)',
                        backgroundColor: '#fafbfc',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem' }}>{p.name}</span>
                        <Badge variant="neutral">Roadmap</Badge>
                      </div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{p.desc}</span>
                      <button disabled className="btn btn-secondary" style={{ opacity: 0.5, cursor: 'not-allowed', fontSize: '0.78rem', height: '30px' }}>
                        In Development
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* SECTION 4: PREFERENCES & NOTIFICATIONS */}
          {activeSection === 'preferences' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                  Preferences &amp; Notifications
                </h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Customize your notification delivery, sound triggers, and automation execution telemetry.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Toast Alerts Preference */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>In-App Toast Notifications</div>
                    <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Show standardized alerts for copy, save, and system events at the top-center-right of the screen.
                    </div>
                  </div>
                  <label className="switch" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={toastAlerts}
                      onChange={(e) => setToastAlerts(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </label>
                </div>

                {/* Application Execution Alerts */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Application Execution Alerts</div>
                    <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Notify upon automated job application completion, form inspection pauses, or errors.
                    </div>
                  </div>
                  <label className="switch" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={appAlerts}
                      onChange={(e) => setAppAlerts(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </label>
                </div>

                {/* Detailed Telemetry Logging */}
                <div
                  style={{
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Detailed Telemetry Logs</div>
                    <div style={{ fontSize: '0.83rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Include detailed HTTP and Playwright selector traces in the Automation Run Details viewer.
                    </div>
                  </div>
                  <label className="switch" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      checked={detailedTelemetry}
                      onChange={(e) => setDetailedTelemetry(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button onClick={handleSavePreferences} className="btn btn-primary">
                  Save Preferences
                </button>
              </div>
            </div>
          )}

          {/* SECTION 5: SYSTEM STATUS */}
          {activeSection === 'system' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                    System Status &amp; Service Health
                  </h2>
                  <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    Live operational telemetry from backend services, databases, encryption, and automation engines.
                  </p>
                </div>

                <button
                  onClick={fetchHealth}
                  disabled={isLoadingHealth}
                  className="btn btn-secondary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
                >
                  <RefreshCw size={14} className={isLoadingHealth ? 'spinner' : ''} />
                  <span>Refresh Health</span>
                </button>
              </div>

              {lastHealthChecked && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Last verified at {lastHealthChecked.toLocaleTimeString()} {healthLatencyMs !== null ? `(${healthLatencyMs}ms roundtrip)` : ''}
                </div>
              )}

              {healthError ? (
                <div
                  role="alert"
                  className="auth-alert auth-alert-error"
                  style={{ padding: '16px' }}
                >
                  <AlertCircle size={20} style={{ flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 700 }}>Service Diagnostics Unavailable</div>
                    <div style={{ fontSize: '0.85rem', marginTop: '2px' }}>{healthError}</div>
                  </div>
                </div>
              ) : isLoadingHealth && !healthData ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Loader2 size={24} className="spinner" style={{ margin: '0 auto 12px auto' }} />
                  <div>Querying live backend diagnostics…</div>
                </div>
              ) : healthData ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {/* API Service */}
                  <div
                    style={{
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Activity size={20} color="var(--primary)" />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>RolePilot API Server</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Service: {healthData.service} • Environment: {healthData.environment}
                        </div>
                      </div>
                    </div>
                    <Badge variant={healthData.status === 'healthy' ? 'success' : 'warning'}>
                      {healthData.status === 'healthy' ? 'Operational' : 'Degraded'}
                    </Badge>
                  </div>

                  {/* Database Health */}
                  <div
                    style={{
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Database size={20} color="var(--primary)" />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>Authoritative Database</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          PostgreSQL / SQLite persistence with transactional tenant isolation.
                        </div>
                      </div>
                    </div>
                    <Badge variant={healthData.database === 'connected' || healthData.database === 'ok' ? 'success' : 'danger'}>
                      {healthData.database === 'connected' || healthData.database === 'ok' ? 'Connected' : 'Disconnected'}
                    </Badge>
                  </div>

                  {/* Session Encryption Engine */}
                  <div
                    style={{
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <KeyRound size={20} color="var(--primary)" />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>Session Encryption Engine</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          AES-256 Fernet cryptographic key for candidate portal cookies.
                        </div>
                      </div>
                    </div>
                    <Badge variant={healthData.session_encryption?.configured ? 'success' : 'warning'}>
                      {healthData.session_encryption?.configured ? 'Configured (Active)' : 'Unconfigured'}
                    </Badge>
                  </div>

                  {/* Browser Engine */}
                  <div
                    style={{
                      padding: '16px 20px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-light)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <Cpu size={20} color="var(--primary)" />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>Browser Automation Engine</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          Playwright Chromium • Triple-Key Live-Submission Guard Active
                        </div>
                      </div>
                    </div>
                    <Badge variant={healthData.browser_engine?.chromium_available ? 'success' : 'neutral'}>
                      {healthData.browser_engine?.chromium_available ? 'Ready' : 'Diagnostic Mode'}
                    </Badge>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* SECTION 6: LEGAL & SUPPORT */}
          {activeSection === 'legal' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
                  Legal &amp; Support Resources
                </h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Official platform terms, privacy documentation, safety standards, and customer help.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
                <div
                  style={{
                    padding: '18px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>Terms of Use</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Platform eligibility, acceptable automation use, and human-oversight policy.
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (onNavigateTerms) onNavigateTerms();
                      else window.location.href = '/terms';
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <span>Read Terms</span>
                    <ExternalLink size={13} />
                  </button>
                </div>

                <div
                  style={{
                    padding: '18px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>Privacy Policy</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Candidate data handling, zero AI model training policy, and data retention rules.
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (onNavigatePrivacy) onNavigatePrivacy();
                      else window.location.href = '/privacy';
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <span>Read Privacy</span>
                    <ExternalLink size={13} />
                  </button>
                </div>

                <div
                  style={{
                    padding: '18px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>Safety Guidelines</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Candidate responsibilities, rate limiting, and ethical automation principles.
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (onNavigateGuidelines) onNavigateGuidelines();
                      else window.location.href = '/guidelines';
                    }}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <span>Read Guidelines</span>
                    <ExternalLink size={13} />
                  </button>
                </div>

                <div
                  style={{
                    padding: '18px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-light)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px',
                    backgroundColor: 'rgba(37, 99, 235, 0.03)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.96rem' }}>RolePilot Support</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Customer assistance, troubleshooting, feedback, and account recovery help.
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (onNavigateSupport) onNavigateSupport();
                      else window.location.href = '/support';
                    }}
                    className="btn btn-primary"
                    style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <span>Contact Support</span>
                    <HelpCircle size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SECTION 7: DANGER ZONE */}
          {activeSection === 'danger' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--danger)' }}>
                  Danger Zone
                </h2>
                <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  Irreversible account operations and permanent data deletion.
                </p>
              </div>

              <div
                style={{
                  padding: '22px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  backgroundColor: 'rgba(239, 68, 68, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <AlertTriangle size={22} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1.02rem', color: 'var(--text-main)' }}>
                      Permanently Delete Account
                    </div>
                    <p style={{ margin: '6px 0 0 0', fontSize: '0.86rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      Deleting your account permanently purges your candidate profile, uploaded resumes, automation runs, telemetry logs, search configurations, and Supabase Auth credentials.
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '0.86rem', color: 'var(--danger)', fontWeight: 600 }}>
                      Notice: Your email address ({email}) will be permanently reserved and cannot be used to register a new RolePilot account after deletion.
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '8px', borderTop: '1px solid rgba(239, 68, 68, 0.15)' }}>
                  <button
                    onClick={() => {
                      setDeleteAccountError(null);
                      setDeleteConfirmationInput('');
                      setIsDeleteModalOpen(true);
                    }}
                    className="btn btn-outline"
                    style={{
                      color: 'var(--danger)',
                      borderColor: 'var(--danger)',
                      fontWeight: 700,
                    }}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Disconnect LinkedIn Confirmation Modal */}
      <Modal
        isOpen={showDisconnectConfirm}
        onClose={() => {
          if (!isDisconnectingLinkedin) setShowDisconnectConfirm(false);
        }}
        title="Disconnect LinkedIn Integration?"
        maxWidth="480px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, color: 'var(--text-main)', lineHeight: 1.6, fontSize: '0.92rem' }}>
            Disconnecting will purge your encrypted LinkedIn session token from our server and revoke automated Easy Apply permissions. You can reconnect at any time with a new session cookie.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button
              onClick={() => setShowDisconnectConfirm(false)}
              disabled={isDisconnectingLinkedin}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleDisconnectLinkedin}
              disabled={isDisconnectingLinkedin}
              className="btn btn-primary"
              style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
            >
              {isDisconnectingLinkedin ? 'Disconnecting…' : 'Confirm Disconnect'}
            </button>
          </div>
        </div>
      </Modal>

      {/* LinkedIn Consent & Connect Modal */}
      <LinkedInConsentModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConsentSuccess={() => {
          setShowConnectModal(false);
          fetchLinkedinStatus();
          showSuccess('LinkedIn account connected successfully.');
        }}
      />


      {/* Permanent Account Deletion Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => {
          if (isDeletingAccount) return;
          setIsDeleteModalOpen(false);
          setDeleteAccountError(null);
        }}
        title="Permanently Delete RolePilot Account?"
        maxWidth="520px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ margin: 0, color: 'var(--text-main)', lineHeight: 1.6, fontSize: '0.92rem' }}>
            This permanently deletes your candidate profile, uploaded resumes, search filters, applications, and automation logs.
          </p>
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontSize: '0.85rem',
              color: 'var(--danger)',
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            <strong>Warning:</strong> You will not be able to create another RolePilot account with this email address (<strong>{email}</strong>). After deletion succeeds, you will be redirected to Support.
          </div>

          <label htmlFor="delete-account-confirmation" style={{ fontSize: '0.88rem', fontWeight: 600 }}>
            Type <strong>DELETE</strong> below to confirm
          </label>
          <input
            id="delete-account-confirmation"
            value={deleteConfirmationInput}
            onChange={(e) => setDeleteConfirmationInput(e.target.value)}
            placeholder="DELETE"
            autoComplete="off"
            disabled={isDeletingAccount}
            className="form-input"
          />

          {deleteAccountError && (
            <p role="alert" style={{ color: 'var(--danger)', margin: 0, fontSize: '0.85rem' }}>
              {deleteAccountError}
            </p>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              disabled={isDeletingAccount}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleteConfirmationInput !== 'DELETE' || isDeletingAccount}
              className="btn btn-primary"
              style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 size={15} className="spinner" />
                  <span>Deleting…</span>
                </>
              ) : (
                'Permanently Delete Account'
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
