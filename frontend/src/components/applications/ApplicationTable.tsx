import React from 'react';
import {
  MapPin,
  Calendar,
  Edit3,
  Trash2,
  Eye,
  Bot,
  ExternalLink,
} from 'lucide-react';
import type { Application } from '../../types/application';
import { StatusBadge } from './StatusBadge';
import { CompanyAvatar, MatchBadge } from '../common';
import { calculateJobMatch } from '../../utils/matching';
import { formatDate } from '../../utils/dates';
import type { Skill } from '../../types/profile';

interface ApplicationTableProps {
  applications: Application[];
  candidateSkills: Skill[];
  selectedApplicationId: string | null;
  onSelect: (app: Application) => void;
  onChangeStatus: (app: Application) => void;
  onDelete: (app: Application) => void;
}

export const ApplicationTable: React.FC<ApplicationTableProps> = ({
  applications,
  candidateSkills,
  selectedApplicationId,
  onSelect,
  onChangeStatus,
  onDelete,
}) => {
  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
          <thead>
            <tr
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                fontSize: '0.8rem',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              <th style={{ padding: '12px 16px', fontWeight: 600 }}>Job & Company</th>
              <th style={{ padding: '12px 14px', fontWeight: 600 }}>Location</th>
              <th style={{ padding: '12px 14px', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '12px 14px', fontWeight: 600 }}>Match</th>
              <th style={{ padding: '12px 14px', fontWeight: 600 }}>Origin</th>
              <th style={{ padding: '12px 14px', fontWeight: 600 }}>Date</th>
              <th style={{ padding: '12px 16px', fontWeight: 600, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((app) => {
              const job = app.job;
              const isSelected = selectedApplicationId === app.id;
              const matchAnalysis = job ? calculateJobMatch(job, candidateSkills) : { matchScore: 0, matchedSkills: [] };

              const dateStr = app.submitted_at
                ? formatDate(app.submitted_at)
                : app.created_at
                ? formatDate(app.created_at)
                : 'Recent';

              return (
                <tr
                  key={app.id}
                  onClick={() => onSelect(app)}
                  style={{
                    borderBottom: '1px solid var(--border-light)',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.05)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--primary)' : '3px solid transparent',
                    transition: 'all 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-subtle)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {/* Job Title & Company */}
                  <td style={{ padding: '14px 16px', minWidth: '220px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <CompanyAvatar name={job?.company} size="sm" />
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            color: 'var(--text-main)',
                            marginBottom: '2px',
                            lineHeight: 1.3,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '260px',
                          }}
                        >
                          {job?.title || 'Job Title Not Available'}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {job?.company || 'Company Not Available'}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Location */}
                  <td style={{ padding: '14px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.82rem' }}>
                      <MapPin size={13} style={{ flexShrink: 0 }} />
                      <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {job?.location || 'Not specified'}
                      </span>
                    </div>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                    <StatusBadge status={app.status} />
                  </td>

                  {/* Match score */}
                  <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                    <MatchBadge
                      matchedCount={matchAnalysis.matchedSkills?.length}
                      totalSkills={candidateSkills.length}
                      size="sm"
                    />
                  </td>

                  {/* Origin */}
                  <td style={{ padding: '14px 14px', whiteSpace: 'nowrap' }}>
                    {app.run_id ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#f3e8ff',
                          color: '#7e22ce',
                        }}
                        title={`Run ID: ${app.run_id}`}
                      >
                        <Bot size={11} />
                        Auto-Apply
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          color: 'var(--text-subtle)',
                        }}
                      >
                        Shortlist
                      </span>
                    )}
                  </td>

                  {/* Date */}
                  <td
                    style={{
                      padding: '14px 14px',
                      color: 'var(--text-subtle)',
                      fontSize: '0.8rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} />
                      <span>{dateStr}</span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '14px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px' }}>
                      <button
                        onClick={() => onSelect(app)}
                        className="btn btn-secondary"
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="View details"
                      >
                        <Eye size={12} />
                        <span>View</span>
                      </button>

                      <button
                        onClick={() => onChangeStatus(app)}
                        className="btn btn-outline"
                        style={{
                          fontSize: '0.75rem',
                          padding: '4px 8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Change Status"
                      >
                        <Edit3 size={12} />
                        <span>Status</span>
                      </button>

                      {job?.job_url && (
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn-icon"
                          style={{
                            padding: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-muted)',
                          }}
                          title="Open LinkedIn Job"
                        >
                          <ExternalLink size={13} />
                        </a>
                      )}

                      <button
                        onClick={() => onDelete(app)}
                        className="btn-icon"
                        style={{
                          color: 'var(--danger)',
                          padding: '4px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Remove application"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
