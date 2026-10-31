import React from 'react';
import { ArrowRight, ChevronRight, Briefcase } from 'lucide-react';
import type { Application } from '../../types/application';
import { formatRelativeDate } from '../../utils/dates';

interface RecentActivityTableProps {
  applications: Application[];
  onNavigateApplications: () => void;
  onNavigateApplication?: (id: string) => void;
}

const AVATAR_COLORS = ['#3B82F6', '#06B6D4', '#6366F1', '#EC4899', '#8B5CF6', '#F59E0B'];

export const RecentActivityTable: React.FC<RecentActivityTableProps> = ({
  applications,
  onNavigateApplications,
  onNavigateApplication,
}) => {
  const recentApps = applications.slice(0, 6);

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'dry_run_completed':
      case 'verified':
        return { label: 'Dry Run Verified', dotColor: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8' };
      case 'applied':
      case 'submitted':
        return { label: 'Applied', dotColor: '#16A34A', bg: '#DCFCE7', text: '#15803D' };
      case 'skipped':
        return { label: 'Skipped', dotColor: '#D97706', bg: '#FEF3C7', text: '#B45309' };
      case 'failed':
      case 'form_failed':
        return { label: 'Form Failed', dotColor: '#DC2626', bg: '#FEE2E2', text: '#B91C1C' };
      case 'unverified':
      case 'submission_unverified':
        return { label: 'Submission Unverified', dotColor: '#DC2626', bg: '#FEE2E2', text: '#B91C1C' };
      case 'running':
        return { label: 'Running', dotColor: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8' };
      case 'queued':
        return { label: 'Queued', dotColor: '#6B7280', bg: '#F3F4F6', text: '#374151' };
      default:
        return { label: status.replace(/_/g, ' '), dotColor: '#6B7280', bg: '#F3F4F6', text: '#374151' };
    }
  };

  return (
    <div
      className="card recent-activity-card"
      style={{
        background: '#FFFFFF',
        borderRadius: '12px',
        border: '1px solid var(--border)',
        padding: '20px 22px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Recent Activity & Applications
          </h2>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Latest automation runs and application outcomes
          </p>
        </div>

        <button
          type="button"
          onClick={onNavigateApplications}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--primary)',
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: 0,
          }}
        >
          <span>View All</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Table Content */}
      {recentApps.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
          <Briefcase size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
          <p style={{ fontWeight: 600, margin: '0 0 4px', color: 'var(--text-main)' }}>No recent activity</p>
          <p style={{ fontSize: '0.8rem', margin: 0 }}>
            Launch a safe dry run to start evaluating matching opportunities.
          </p>
        </div>
      ) : (
        <div className="table-responsive-container" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-light)', color: 'var(--text-muted)', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '8px 12px 10px 0', fontWeight: 600 }}>Job Title</th>
                <th style={{ padding: '8px 12px 10px', fontWeight: 600 }}>Company</th>
                <th style={{ padding: '8px 12px 10px', fontWeight: 600 }}>Type</th>
                <th style={{ padding: '8px 12px 10px', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '8px 12px 10px', fontWeight: 600 }}>Time</th>
                <th style={{ padding: '8px 0 10px 12px', width: '24px' }}></th>
              </tr>
            </thead>
            <tbody>
              {recentApps.map((app, idx) => {
                const statusInfo = getStatusDisplay(app.status);
                const title = app.job?.title || 'Automation Test Engineer';
                const company = app.job?.company || 'TechLabs';
                const initial = (company.trim()[0] || 'T').toUpperCase();
                const avatarColor = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                const isEasyApply = true; // Most LinkedIn jobs processed through RolePilot are Easy Apply

                return (
                  <tr
                    key={app.id || idx}
                    onClick={() => {
                      if (app.id && onNavigateApplication) {
                        onNavigateApplication(app.id);
                      } else {
                        onNavigateApplications();
                      }
                    }}
                    style={{
                      borderBottom: idx < recentApps.length - 1 ? '1px solid #F1F5F9' : 'none',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    className="dashboard-table-row"
                  >
                    {/* Job Title with Letter Avatar */}
                    <td style={{ padding: '12px 12px 12px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            backgroundColor: `${avatarColor}1A`,
                            color: avatarColor,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.75rem',
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {initial}
                        </div>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)', maxWidth: '240px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {title}
                        </span>
                      </div>
                    </td>

                    {/* Company */}
                    <td style={{ padding: '12px', color: 'var(--text-muted)' }}>
                      <span style={{ maxWidth: '160px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'inline-block' }}>
                        {company}
                      </span>
                    </td>

                    {/* Type Badge */}
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: isEasyApply ? '#DCFCE7' : '#F1F5F9',
                          color: isEasyApply ? '#15803D' : '#64748B',
                        }}
                      >
                        {isEasyApply ? 'Easy Apply' : 'External ATS'}
                      </span>
                    </td>

                    {/* Status Badge with Color Dot */}
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '9999px',
                          backgroundColor: statusInfo.bg,
                          color: statusInfo.text,
                        }}
                      >
                        <span
                          style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: statusInfo.dotColor,
                          }}
                        />
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* Time */}
                    <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.76rem', whiteSpace: 'nowrap' }}>
                      {formatRelativeDate(app.created_at || app.submitted_at)}
                    </td>

                    {/* Chevron */}
                    <td style={{ padding: '12px 0 12px 12px', textAlign: 'right', color: 'var(--text-muted)' }}>
                      <ChevronRight size={14} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
