import React, { useState } from 'react';
import {
  Search,
  MapPin,
  Building2,
  RotateCcw,
  Zap,
  ChevronDown,
  ChevronUp,
  Filter,
} from 'lucide-react';

export interface FilterState {
  searchTerm: string;
  locationTerm: string;
  companyTerm: string;
  applicationStatus: 'all' | 'not_applied' | 'saved' | 'applied';
  jobType: string;
  workMode: string;
  experienceLevel: string;
  easyApplyOnly: boolean;
  minSalary: number | null;
  datePosted: string;
  sortBy: 'match' | 'date' | 'company';
}

interface JobFiltersProps {
  filters: FilterState;
  onFilterChange: <K extends keyof FilterState>(key: K, value: FilterState[K]) => void;
  onResetFilters: () => void;
  totalCount: number;
  filteredCount: number;
}

export const JobFilters: React.FC<JobFiltersProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  totalCount,
  filteredCount,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count active filters (excluding defaults)
  let activeFilterCount = 0;
  if (filters.searchTerm) activeFilterCount++;
  if (filters.locationTerm) activeFilterCount++;
  if (filters.companyTerm) activeFilterCount++;
  if (filters.applicationStatus !== 'all') activeFilterCount++;
  if (filters.jobType !== 'all') activeFilterCount++;
  if (filters.workMode !== 'all') activeFilterCount++;
  if (filters.experienceLevel !== 'all') activeFilterCount++;
  if (filters.easyApplyOnly) activeFilterCount++;
  if (filters.minSalary !== null) activeFilterCount++;
  if (filters.datePosted !== 'all') activeFilterCount++;

  const salaryPresets = [
    { label: 'Any', value: null },
    { label: '₹5L+', value: 500000 },
    { label: '₹8L+', value: 800000 },
    { label: '₹12L+', value: 1200000 },
    { label: '₹15L+', value: 1500000 },
  ];

  return (
    <div className="card" style={{ padding: '16px', marginBottom: '20px' }}>
      {/* Primary search bar & toggle row */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          alignItems: 'center',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
        }}
      >
        {/* Search input */}
        <div style={{ position: 'relative', flex: '1 1 280px', minWidth: '220px' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-subtle)',
            }}
          />
          <input
            type="text"
            value={filters.searchTerm}
            onChange={(e) => onFilterChange('searchTerm', e.target.value)}
            placeholder="Search job title, skills, or keywords..."
            className="form-input"
            style={{ paddingLeft: '36px', height: '40px', fontSize: '0.88rem' }}
          />
        </div>

        {/* Quick controls: Easy Apply toggle + Filter drawer toggle + Sort */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Easy Apply Quick Chip */}
          <button
            type="button"
            onClick={() => onFilterChange('easyApplyOnly', !filters.easyApplyOnly)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: filters.easyApplyOnly ? '1px solid #16a34a' : '1px solid var(--border-color)',
              backgroundColor: filters.easyApplyOnly ? '#dcfce7' : 'var(--bg-subtle)',
              color: filters.easyApplyOnly ? '#15803d' : 'var(--text-muted)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              height: '40px',
              transition: 'all 0.1s ease',
            }}
          >
            <Zap size={13} fill={filters.easyApplyOnly ? '#15803d' : 'none'} />
            <span>Easy Apply</span>
          </button>

          {/* Filter drawer toggle button */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className={`btn ${isExpanded ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              height: '40px',
              padding: '0 12px',
              fontSize: '0.82rem',
              fontWeight: 600,
            }}
          >
            <Filter size={14} />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  backgroundColor: isExpanded ? '#ffffff' : 'var(--primary)',
                  color: isExpanded ? 'var(--primary)' : '#ffffff',
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontWeight: 700,
                }}
              >
                {activeFilterCount}
              </span>
            )}
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Sort By Dropdown */}
          <div style={{ flex: '0 0 auto' }}>
            <select
              value={filters.sortBy}
              onChange={(e) => onFilterChange('sortBy', e.target.value as FilterState['sortBy'])}
              className="form-select"
              style={{
                height: '40px',
                padding: '0 28px 0 10px',
                fontSize: '0.82rem',
                backgroundColor: 'var(--bg-subtle)',
              }}
            >
              <option value="match">Sort: High Match</option>
              <option value="date">Sort: Newest</option>
              <option value="company">Sort: Company A-Z</option>
            </select>
          </div>

          {/* Clear all button */}
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={onResetFilters}
              className="btn-icon"
              title="Reset all filters"
              style={{
                height: '40px',
                width: '40px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filter Drawer */}
      {isExpanded && (
        <div
          style={{
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-light)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
          }}
        >
          {/* Location input */}
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Location Preference
            </label>
            <div style={{ position: 'relative' }}>
              <MapPin
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-subtle)',
                }}
              />
              <input
                type="text"
                value={filters.locationTerm}
                onChange={(e) => onFilterChange('locationTerm', e.target.value)}
                placeholder="e.g. India, Noida, Bangalore..."
                className="form-input"
                style={{ paddingLeft: '32px', height: '36px', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          {/* Company input */}
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Company Filter
            </label>
            <div style={{ position: 'relative' }}>
              <Building2
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-subtle)',
                }}
              />
              <input
                type="text"
                value={filters.companyTerm}
                onChange={(e) => onFilterChange('companyTerm', e.target.value)}
                placeholder="e.g. HappieHire, Google..."
                className="form-input"
                style={{ paddingLeft: '32px', height: '36px', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          {/* Application Pipeline Status */}
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Application State
            </label>
            <select
              value={filters.applicationStatus}
              onChange={(e) => onFilterChange('applicationStatus', e.target.value as FilterState['applicationStatus'])}
              className="form-select"
              style={{ height: '36px', fontSize: '0.82rem' }}
            >
              <option value="all">All Jobs</option>
              <option value="not_applied">Not Applied</option>
              <option value="saved">Saved Shortlist</option>
              <option value="applied">Applied (Submitted)</option>
            </select>
          </div>

          {/* Work Mode */}
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Work Mode
            </label>
            <select
              value={filters.workMode}
              onChange={(e) => onFilterChange('workMode', e.target.value)}
              className="form-select"
              style={{ height: '36px', fontSize: '0.82rem' }}
            >
              <option value="all">All Modes</option>
              <option value="remote">Remote Only</option>
              <option value="hybrid">Hybrid</option>
              <option value="onsite">On-site</option>
            </select>
          </div>

          {/* Job Type */}
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Job Type
            </label>
            <select
              value={filters.jobType}
              onChange={(e) => onFilterChange('jobType', e.target.value)}
              className="form-select"
              style={{ height: '36px', fontSize: '0.82rem' }}
            >
              <option value="all">All Job Types</option>
              <option value="full-time">Full-time</option>
              <option value="part-time">Part-time</option>
              <option value="contract">Contract</option>
              <option value="internship">Internship</option>
            </select>
          </div>

          {/* Experience Level */}
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Experience Level
            </label>
            <select
              value={filters.experienceLevel}
              onChange={(e) => onFilterChange('experienceLevel', e.target.value)}
              className="form-select"
              style={{ height: '36px', fontSize: '0.82rem' }}
            >
              <option value="all">All Experience Levels</option>
              <option value="entry">Entry Level</option>
              <option value="associate">Associate</option>
              <option value="mid-senior">Mid-Senior Level</option>
              <option value="director">Director / Executive</option>
            </select>
          </div>

          {/* Date Posted */}
          <div>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
              Date Posted
            </label>
            <select
              value={filters.datePosted}
              onChange={(e) => onFilterChange('datePosted', e.target.value)}
              className="form-select"
              style={{ height: '36px', fontSize: '0.82rem' }}
            >
              <option value="all">Any time</option>
              <option value="today">Past 24 hours</option>
              <option value="past-week">Past week</option>
              <option value="past-month">Past month</option>
            </select>
          </div>

          {/* Salary Minimum Presets */}
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', display: 'block' }}>
              Minimum Salary Expectation
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              {salaryPresets.map((preset) => {
                const isSelected = filters.minSalary === preset.value;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onFilterChange('minSalary', preset.value)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '16px',
                      border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                      backgroundColor: isSelected ? 'var(--primary-light)' : '#ffffff',
                      color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                      fontSize: '0.78rem',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      transition: 'all 0.1s ease',
                    }}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Filter status counter footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '10px',
          paddingTop: '8px',
          borderTop: '1px solid var(--border-light)',
          fontSize: '0.78rem',
          color: 'var(--text-subtle)',
        }}
      >
        <span>
          Showing <strong style={{ color: 'var(--text-main)' }}>{filteredCount}</strong> of{' '}
          <strong>{totalCount}</strong> jobs
        </span>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onResetFilters}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              padding: '2px 4px',
            }}
          >
            Clear active filters
          </button>
        )}
      </div>
    </div>
  );
};
