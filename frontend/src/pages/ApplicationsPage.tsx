import React, { useEffect, useState, useMemo } from 'react';
import {
  Briefcase,
  RefreshCw,
  Bookmark,
  Layers,
} from 'lucide-react';
import { applicationsApi, type Application } from '../api/applications';
import { profileApi } from '../api/profile';
import { useAuth } from '../context/AuthContext';
import { formatErrorMessage } from '../api/client';
import { ApplicationStats } from '../components/applications/ApplicationStats';
import { ApplicationFilters } from '../components/applications/ApplicationFilters';
import { ApplicationTable } from '../components/applications/ApplicationTable';
import { ApplicationCard } from '../components/applications/ApplicationCard';
import { ApplicationDetailsPanel } from '../components/applications/ApplicationDetailsPanel';
import { ApplicationStatusModal } from '../components/applications/ApplicationStatusModal';
import { DeleteApplicationModal } from '../components/applications/DeleteApplicationModal';
import { EmptyState, ErrorState, ListCardSkeleton } from '../components/common';
import type { Profile } from '../types/profile';

interface ApplicationsPageProps {
  initialApplicationId?: string | null;
  onClearInitialApplication?: () => void;
  onNavigateToJobs?: () => void;
  onNavigateToRun?: (runId: string) => void;
  isActive?: boolean;
}

export const ApplicationsPage: React.FC<ApplicationsPageProps> = ({
  initialApplicationId,
  onClearInitialApplication,
  onNavigateToJobs,
  onNavigateToRun,
}) => {
  const { isAuthenticated } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<Application | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters & View Mode
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modals state
  const [statusModalApp, setStatusModalApp] = useState<Application | null>(null);
  const [deleteModalApp, setDeleteModalApp] = useState<Application | null>(null);

  // Fetch applications & candidate profile
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [profileData, appsData] = await Promise.all([
        profileApi.getProfile().catch(() => null),
        applicationsApi.getApplications(),
      ]);

      if (profileData) setProfile(profileData);
      setApplications(appsData);

      // Keep or update selected application on desktop
      if (appsData.length > 0) {
        const isMobileScreen = typeof window !== 'undefined' && window.innerWidth <= 768;
        setSelectedApplication((prev) => {
          if (prev) {
            const found = appsData.find((a) => a.id === prev.id);
            return found || appsData[0];
          }
          return isMobileScreen ? null : appsData[0];
        });
      } else {
        setSelectedApplication(null);
      }
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  // Sync initialApplicationId when navigated from another page
  useEffect(() => {
    if (initialApplicationId && applications.length > 0) {
      const match = applications.find((a) => a.id === initialApplicationId);
      if (match) {
        setSelectedApplication(match);
        setStatusFilter('all');
        setSearchTerm('');
      }
      if (onClearInitialApplication) {
        onClearInitialApplication();
      }
    }
  }, [initialApplicationId, applications, onClearInitialApplication]);

  // Client-side filtering
  const filteredApplications = useMemo(() => {
    return applications.filter((app) => {
      // Status filter
      if (statusFilter && statusFilter !== 'all') {
        const normStatus = (app.status || 'saved').toLowerCase();
        if (statusFilter === 'applied') {
          if (normStatus !== 'applied' && normStatus !== 'submitted' && normStatus !== 'pending') {
            return false;
          }
        } else if (normStatus !== statusFilter.toLowerCase()) {
          return false;
        }
      }

      // Search term filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const title = (app.job?.title || '').toLowerCase();
        const company = (app.job?.company || '').toLowerCase();
        const location = (app.job?.location || '').toLowerCase();
        if (!title.includes(term) && !company.includes(term) && !location.includes(term)) {
          return false;
        }
      }

      return true;
    });
  }, [applications, statusFilter, searchTerm]);

  // Mutation handlers
  const handleStatusUpdated = (updated: Application) => {
    setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
    if (selectedApplication?.id === updated.id) {
      setSelectedApplication(updated);
    }
  };

  const handleApplicationDeleted = (deletedId: string) => {
    setApplications((prev) => prev.filter((a) => a.id !== deletedId));
    if (selectedApplication?.id === deletedId) {
      const remaining = applications.filter((a) => a.id !== deletedId);
      setSelectedApplication(remaining.length > 0 ? remaining[0] : null);
    }
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
  };

  return (
    <div className="container" style={{ paddingBottom: '60px' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          margin: '24px 0 20px 0',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
            Applications Tracker
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Auditable application lifecycle, question-answer inspector, and candidate hiring pipeline.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {onNavigateToJobs && (
            <button
              onClick={onNavigateToJobs}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Briefcase size={16} />
              <span>Browse Jobs</span>
            </button>
          )}

          <button
            onClick={fetchData}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            disabled={isLoading}
          >
            <RefreshCw size={16} className={isLoading ? 'spin-animation' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <ApplicationStats
        applications={applications}
        activeStatusFilter={statusFilter}
        onSelectStatus={(s) => setStatusFilter(s)}
      />

      {/* Filter toolbar */}
      <ApplicationFilters
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onClearFilters={handleClearFilters}
      />

      {/* Error alert with retry */}
      {error && <ErrorState message={error} onRetry={fetchData} />}

      {/* Main content */}
      {isLoading ? (
        <ListCardSkeleton count={4} />
      ) : applications.length === 0 ? (
        /* Zero applications overall */
        <EmptyState
          icon={Layers}
          title="No applications tracked yet"
          description="Start by saving a job from the Jobs page to build your shortlist or launch an autonomous automation run."
          actionText={onNavigateToJobs ? "Browse Jobs" : undefined}
          onAction={onNavigateToJobs}
        />
      ) : filteredApplications.length === 0 ? (
        /* Filtered empty state */
        <EmptyState
          icon={Bookmark}
          title={
            statusFilter === 'saved'
              ? 'No saved jobs in your shortlist'
              : statusFilter === 'rejected'
              ? 'No rejected applications'
              : statusFilter === 'offer'
              ? 'No job offers recorded yet'
              : 'No applications match your search filters'
          }
          description="Try resetting your status or search terms to view other applications."
          actionText="Clear Filters"
          onAction={handleClearFilters}
        />
      ) : (
        /* Responsive Application Tracking View */
        <div className="applications-page-grid">
          {/* List/Table Pane (On mobile: hidden if an application is selected) */}
          <div className={selectedApplication ? 'desktop-only' : ''}>
            {/* Desktop Table View */}
            {viewMode === 'table' ? (
              <div className="desktop-table-view">
                <ApplicationTable
                  applications={filteredApplications}
                  candidateSkills={profile?.skills || []}
                  selectedApplicationId={selectedApplication?.id || null}
                  onSelect={(app) => setSelectedApplication(app)}
                  onChangeStatus={(app) => setStatusModalApp(app)}
                  onDelete={(app) => setDeleteModalApp(app)}
                />
              </div>
            ) : null}

            {/* Cards View (always used on mobile, or when cards view is toggled on desktop) */}
            <div className={viewMode === 'table' ? 'mobile-only' : ''}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredApplications.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    application={app}
                    candidateSkills={profile?.skills || []}
                    isSelected={selectedApplication?.id === app.id}
                    onSelect={() => setSelectedApplication(app)}
                    onChangeStatus={() => setStatusModalApp(app)}
                    onDelete={() => setDeleteModalApp(app)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Details Side Panel (On mobile: visible full-width when selected) */}
          {selectedApplication ? (
            <div className="application-details-pane">
              <ApplicationDetailsPanel
                application={selectedApplication}
                candidateSkills={profile?.skills || []}
                onClose={() => setSelectedApplication(null)}
                onChangeStatus={(app) => setStatusModalApp(app)}
                onDelete={(app) => setDeleteModalApp(app)}
                onNavigateToRun={onNavigateToRun}
                onNavigateToJobs={onNavigateToJobs}
              />
            </div>
          ) : (
            <div
              className="card desktop-only"
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-subtle)',
              }}
            >
              <Briefcase size={36} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Select an application
              </h4>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                Click on any application to inspect answers, lifecycle progression, and telemetry logs.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Change Status Modal */}
      <ApplicationStatusModal
        application={statusModalApp}
        isOpen={Boolean(statusModalApp)}
        onClose={() => setStatusModalApp(null)}
        onStatusUpdated={handleStatusUpdated}
      />

      {/* Delete Confirmation Modal */}
      <DeleteApplicationModal
        application={deleteModalApp}
        isOpen={Boolean(deleteModalApp)}
        onClose={() => setDeleteModalApp(null)}
        onDeleted={handleApplicationDeleted}
      />
    </div>
  );
};
