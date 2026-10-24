import React from 'react';
import {
  MapPin,
  Calendar,
  Edit3,
  Trash2,
  Bot,
  ExternalLink,
} from 'lucide-react';
import type { Application } from '../../types/application';
import { StatusBadge } from './StatusBadge';
import { CompanyAvatar, MatchBadge } from '../common';
import { calculateJobMatch } from '../../utils/matching';
import { formatDate } from '../../utils/dates';
import type { Skill } from '../../types/profile';

interface ApplicationCardProps {
  application: Application;
  candidateSkills: Skill[];
  isSelected: boolean;
  onSelect: () => void;
  onChangeStatus: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const ApplicationCard: React.FC<ApplicationCardProps> = ({
  application,
  candidateSkills,
  isSelected,
  onSelect,
  onChangeStatus,
  onDelete,
}) => {
  const job = application.job;
  const matchAnalysis = job ? calculateJobMatch(job, candidateSkills) : { matchScore: 0, matchedSkills: [] };

  const dateStr = application.submitted_at
    ? formatDate(application.submitted_at)
    : application.created_at
    ? formatDate(application.created_at)
    : 'Recently';

  return (
    <div
      onClick={onSelect}
      className="card"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      style={{
        padding: '16px',
        marginBottom: '12px',
        cursor: 'pointer',
        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
        borderRadius: 'var(--radius-md)',
        boxShadow: isSelected ? '0 4px 12px rgba(37, 99, 235, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
        backgroundColor: isSelected ? '#f8fafc' : '#ffffff',
        transition: 'all 0.15s ease',
        position: 'relative',
        outline: 'none',
      }}
    >
      {/* Top Header: Company Avatar + Title + Status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
        <CompanyAvatar name={job?.company} size="md" />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: '8px',
              flexWrap: 'wrap',
            }}
          >
            <h3
              style={{
                fontSize: '0.98rem',
                fontWeight: 700,
                color: 'var(--text-main)',
                margin: '0 0 2px 0',
                lineHeight: 1.3,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >
              {job?.title || 'Job Application'}
            </h3>
            <StatusBadge status={application.status} />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.85rem',
              color: 'var(--text-muted)',
              flexWrap: 'wrap',
              marginTop: '2px',
            }}
          >
            <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
              {job?.company || 'Company'}
            </span>
            {job?.location && (
              <>
                <span style={{ color: 'var(--border-subtle)' }}>•</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '0.8rem' }}>
                  <MapPin size={12} />
                  <span>{job.location}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Badges Bar: Match Tier + Origin Channel */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          margin: '10px 0',
        }}
      >
        <MatchBadge
          matchedCount={matchAnalysis.matchedSkills?.length}
          totalSkills={candidateSkills.length}
          size="sm"
        />

        {application.run_id && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '3px 8px',
              borderRadius: '12px',
              backgroundColor: '#f3e8ff',
              color: '#7e22ce',
            }}
          >
            <Bot size={11} />
            RolePilot Auto-Apply
          </span>
        )}
      </div>

      {/* Footer Info & Actions */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: '10px',
          borderTop: '1px solid var(--border-light)',
          fontSize: '0.8rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--text-subtle)' }}>
          <Calendar size={13} />
          <span>{dateStr}</span>
        </div>

        {/* Action hit targets (touch-friendly >= 44px) */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          onClick={(e) => e.stopPropagation()}
        >
          {job?.job_url && (
            <a
              href={job.job_url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-outline"
              style={{
                minHeight: '36px',
                minWidth: '36px',
                padding: '6px 8px',
                fontSize: '0.75rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Open LinkedIn Job"
            >
              <ExternalLink size={13} />
            </a>
          )}

          <button
            onClick={onChangeStatus}
            className="btn btn-outline"
            style={{
              minHeight: '36px',
              padding: '6px 10px',
              fontSize: '0.75rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Edit3 size={13} />
            <span>Status</span>
          </button>

          <button
            onClick={onDelete}
            className="btn-icon"
            style={{
              minHeight: '36px',
              minWidth: '36px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--danger)',
              padding: '6px',
            }}
            title="Remove application"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
};
