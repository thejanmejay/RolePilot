import React, { useState } from 'react';
import {
  Sliders,
  MapPin,
  Briefcase,
  Laptop,
  CheckCircle2,
  IndianRupee,
  Edit2,
  Plus,
  ArrowRight,
} from 'lucide-react';
import type { SearchConfig } from '../../types/job';
import { SearchConfigModal } from '../jobs/SearchConfigModal';

interface SearchCriteriaSectionProps {
  searchConfigs: SearchConfig[];
  onSearchConfigChanged: () => void;
  onNavigateTab?: (tab: 'jobs' | 'automation') => void;
}

export const SearchCriteriaSection: React.FC<SearchCriteriaSectionProps> = ({
  searchConfigs,
  onSearchConfigChanged,
  onNavigateTab,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Active search config
  const activeConfig = searchConfigs.find((c) => c.is_active) || searchConfigs[0];

  // Parse keywords safely (can be array or string)
  const getRoles = (keywords: any): string[] => {
    if (!keywords) return ['QA Automation', 'SDET'];
    if (Array.isArray(keywords)) return keywords;
    if (typeof keywords === 'string') {
      return keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
    }
    return ['QA Automation'];
  };

  const roles = activeConfig ? getRoles(activeConfig.keywords) : [];

  return (
    <div className="card" id="search-criteria-section" style={{ marginBottom: '24px' }}>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="card-title">
            <Sliders size={20} color="var(--primary)" />
            <span>Search Criteria & Discovery Rules</span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Job discovery parameters used by LinkedIn Hunter to scrape and qualify target listings.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {activeConfig ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-outline"
              style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Edit2 size={13} />
              <span>Edit Search Criteria</span>
            </button>
          ) : (
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn btn-primary"
              style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              <span>Create Search Criteria</span>
            </button>
          )}

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('jobs')}
              className="btn btn-ghost"
              style={{ fontSize: '0.8rem', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Open Jobs Explorer workspace"
            >
              <span>Jobs Explorer</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="card-body">
        {!activeConfig ? (
          <div
            className="empty-state"
            style={{
              padding: '32px 20px',
              border: '2px dashed var(--border-light)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
            }}
          >
            <Sliders size={40} style={{ color: 'var(--text-subtle)', marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              No Search Criteria Configured
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', maxWidth: '420px', margin: '0 auto 16px auto' }}>
              Define target roles, location, and Easy Apply preferences so the automation engine knows which jobs to target.
            </p>
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary">
              <Plus size={15} />
              <span>Configure Search Criteria</span>
            </button>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
            }}
          >
            {/* Target Roles */}
            <div
              style={{
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '8px' }}>
                Target Roles
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {roles.length > 0 ? (
                  roles.map((role, i) => (
                    <span
                      key={i}
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        backgroundColor: 'var(--primary-light)',
                        color: 'var(--primary)',
                        border: '1px solid var(--primary-border)',
                        padding: '3px 10px',
                        borderRadius: '12px',
                      }}
                    >
                      {role}
                    </span>
                  ))
                ) : (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>QA Engineer, SDET</span>
                )}
              </div>
            </div>

            {/* Location */}
            <div
              style={{
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '8px' }}>
                Location
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                <MapPin size={16} color="var(--primary)" />
                <span>{activeConfig.location || 'Noida / Delhi NCR, India'}</span>
              </div>
            </div>

            {/* Work Mode */}
            <div
              style={{
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '8px' }}>
                Work Mode
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                <Laptop size={16} color="var(--primary)" />
                <span>
                  {activeConfig.remote_type
                    ? activeConfig.remote_type.charAt(0).toUpperCase() + activeConfig.remote_type.slice(1)
                    : 'Remote / Hybrid'}
                </span>
              </div>
            </div>

            {/* Experience */}
            <div
              style={{
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '8px' }}>
                Experience Level
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                <Briefcase size={16} color="var(--primary)" />
                <span>{activeConfig.experience_level || 'Mid-Senior, Associate'}</span>
              </div>
            </div>

            {/* Easy Apply */}
            <div
              style={{
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '8px' }}>
                Easy Apply Filter
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 700, color: 'var(--success)' }}>
                <CheckCircle2 size={16} />
                <span>{activeConfig.easy_apply_only !== false ? '✓ Only' : 'All Listings'}</span>
              </div>
            </div>

            {/* Salary */}
            <div
              style={{
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                border: '1px solid var(--border-light)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
              }}
            >
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '8px' }}>
                Target Minimum Salary
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-main)' }}>
                <IndianRupee size={15} color="var(--primary)" />
                <span>
                  {activeConfig.salary_min != null && activeConfig.salary_min > 0
                    ? `₹${activeConfig.salary_min >= 100000 ? `${(activeConfig.salary_min / 100000).toFixed(0)}L+` : `${activeConfig.salary_min}+`}`
                    : '₹8L+'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Edit Search Config Modal */}
      <SearchConfigModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfigCreated={onSearchConfigChanged}
      />
    </div>
  );
};
