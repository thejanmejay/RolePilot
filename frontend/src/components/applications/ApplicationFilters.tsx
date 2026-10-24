import React from 'react';
import { Search, RotateCcw, LayoutGrid, Table } from 'lucide-react';

interface ApplicationFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  viewMode: 'table' | 'cards';
  onViewModeChange: (mode: 'table' | 'cards') => void;
  onClearFilters: () => void;
}

export const ApplicationFilters: React.FC<ApplicationFiltersProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  viewMode,
  onViewModeChange,
  onClearFilters,
}) => {
  const statusOptions = [
    { value: 'all', label: 'All Statuses' },
    { value: 'saved', label: 'Saved (Shortlisted)' },
    { value: 'applied', label: 'Applied (Submitted)' },
    { value: 'interviewing', label: 'Interviewing' },
    { value: 'offer', label: 'Offer' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'withdrawn', label: 'Withdrawn' },
  ];

  const hasActiveFilters = Boolean(searchTerm) || (statusFilter !== 'all' && Boolean(statusFilter));

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: '20px' }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Search input */}
        <div style={{ position: 'relative', flex: '1 1 260px', minWidth: '200px' }}>
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
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by job title, company, or location..."
            className="form-input"
            style={{ paddingLeft: '36px', height: '40px', fontSize: '0.88rem' }}
          />
        </div>

        {/* Right side controls: Status filter + View toggle + Clear */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          {/* Status Dropdown */}
          <div style={{ flex: '0 0 auto' }}>
            <select
              value={statusFilter || 'all'}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className="form-select"
              style={{
                height: '40px',
                padding: '0 32px 0 12px',
                fontSize: '0.85rem',
                backgroundColor: 'var(--bg-subtle)',
              }}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Desktop View Mode Toggle (Table vs Cards) */}
          <div
            className="desktop-only"
            style={{
              display: 'flex',
              backgroundColor: 'var(--bg-subtle)',
              borderRadius: 'var(--radius-sm)',
              padding: '3px',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              onClick={() => onViewModeChange('table')}
              title="Table View"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '4px',
                border: 'none',
                backgroundColor: viewMode === 'table' ? '#ffffff' : 'transparent',
                color: viewMode === 'table' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'table' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
              }}
            >
              <Table size={14} />
              <span>Table</span>
            </button>
            <button
              onClick={() => onViewModeChange('cards')}
              title="Card View"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 10px',
                fontSize: '0.78rem',
                fontWeight: 600,
                borderRadius: '4px',
                border: 'none',
                backgroundColor: viewMode === 'cards' ? '#ffffff' : 'transparent',
                color: viewMode === 'cards' ? 'var(--primary)' : 'var(--text-muted)',
                boxShadow: viewMode === 'cards' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
              }}
            >
              <LayoutGrid size={14} />
              <span>Cards</span>
            </button>
          </div>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                height: '40px',
                padding: '0 12px',
              }}
            >
              <RotateCcw size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
