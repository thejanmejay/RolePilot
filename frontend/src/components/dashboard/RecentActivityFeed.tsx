import React from 'react';
import { ArrowRight, Briefcase, Calendar, ExternalLink } from 'lucide-react';
import type { Application } from '../../types/application';
import { StatusBadge, CompanyAvatar, EmptyState } from '../common';
import { formatRelativeDate } from '../../utils/dates';

interface RecentActivityFeedProps {
  applications: Application[];
  onNavigateToApplications: () => void;
  onNavigateToApplication?: (applicationId: string) => void;
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  applications,
  onNavigateToApplications,
  onNavigateToApplication,
}) => {
  const recentApps = applications.slice(0, 6);

  return (
    <div className="card" style={{ marginBottom: '24px' }}>
      <div className="card-header">
        <div>
          <h2 className="card-title" style={{ fontSize: '1.05rem', fontWeight: 700 }}>
            Recent Activity & Applications
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Latest tracked application attempts and outcomes
          </p>
        </div>

        <button
          onClick={onNavigateToApplications}
          className="btn btn-outline"
          style={{
            fontSize: '0.82rem',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: '36px',
          }}
        >
          <span>View All ({applications.length})</span>
          <ArrowRight size={14} />
        </button>
      </div>

      <div>
        {recentApps.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="No application activity recorded yet"
            description="Launch a dry run or save jobs from the Jobs Explorer to track activity here."
            actionText="Browse Jobs"
            onAction={onNavigateToApplications}
            style={{ padding: '36px 20px', border: 'none', boxShadow: 'none' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentApps.map((app, index) => {
              const formattedDate = formatRelativeDate(app.created_at || app.submitted_at);

              return (
                <div
                  key={app.id || index}
                  onClick={() => {
                    if (app.id && onNavigateToApplication) {
                      onNavigateToApplication(app.id);
                    } else {
                      onNavigateToApplications();
                    }
                  }}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 20px',
                    borderBottom: index < recentApps.length - 1 ? '1px solid var(--border-light)' : 'none',
                    gap: '12px',
                    transition: 'background-color 0.15s ease',
                    cursor: 'pointer',
                  }}
                  className="activity-feed-item"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '220px', flex: 1 }}>
                    <CompanyAvatar name={app.job?.company} size="sm" />

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          color: 'var(--text-main)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {app.job?.title || 'LinkedIn Opportunity'}
                      </div>

                      <div
                        style={{
                          fontSize: '0.78rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          marginTop: '2px',
                        }}
                      >
                        <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{app.job?.company || 'Company'}</span>
                        {app.job?.location && (
                          <>
                            <span>•</span>
                            <span>{app.job.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <Calendar size={13} />
                      <span>{formattedDate}</span>
                    </div>

                    <StatusBadge status={app.status} size="sm" />

                    {app.application_url && (
                      <a
                        href={app.application_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-icon"
                        title="Open on LinkedIn"
                        style={{ width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
