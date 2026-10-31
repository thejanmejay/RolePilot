import React from 'react';
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Bookmark,
  CalendarCheck,
  Award,
  Ban,
  Play,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';

export type CanonicalApplicationStatus =
  | 'pending'
  | 'dry_run_completed'
  | 'submission_attempted'
  | 'applied'
  | 'submission_failed'
  | 'skipped'
  | 'failed'
  | 'saved'
  | 'interviewing'
  | 'offer'
  | 'rejected'
  | 'withdrawn';

export interface StatusMeta {
  key: string;
  label: string;
  color: string;
  bg: string;
  borderColor: string;
  description: string;
  icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
}

/**
 * Normalizes any incoming application status to the architectural canonical set.
 */
export function normalizeApplicationStatus(status?: string | null): CanonicalApplicationStatus {
  if (!status) return 'saved';
  const norm = status.trim().toLowerCase().replace(/[\s-]+/g, '_');

  // Alias mappings to preserve canonical consistency
  if (norm === 'submitted' || norm === 'success' || norm === 'successful' || norm === 'complete') {
    return 'applied';
  }
  if (norm === 'dry_run' || norm === 'dryrun' || norm === 'dry_run_passed') {
    return 'dry_run_completed';
  }
  if (norm === 'error' || norm === 'failure') {
    return 'failed';
  }
  if (norm === 'skip') {
    return 'skipped';
  }
  if (norm === 'shortlist' || norm === 'shortlisted' || norm === 'bookmarked') {
    return 'saved';
  }

  // Canonical set check
  const canonicalSet: CanonicalApplicationStatus[] = [
    'pending',
    'dry_run_completed',
    'submission_attempted',
    'applied',
    'submission_failed',
    'skipped',
    'failed',
    'saved',
    'interviewing',
    'offer',
    'rejected',
    'withdrawn',
  ];

  if (canonicalSet.includes(norm as CanonicalApplicationStatus)) {
    return norm as CanonicalApplicationStatus;
  }

  return 'pending';
}

/**
 * Returns UI metadata (labels, colors, icons, descriptions) for application statuses.
 */
export function getApplicationStatusMeta(status?: string | null): StatusMeta {
  const canonical = normalizeApplicationStatus(status);

  switch (canonical) {
    case 'applied':
      return {
        key: 'applied',
        label: 'Applied',
        color: '#15803d',
        bg: '#dcfce7',
        borderColor: '#bbf7d0',
        description: 'Application successfully submitted and verified via LinkedIn Easy Apply.',
        icon: CheckCircle2,
      };

    case 'dry_run_completed':
      return {
        key: 'dry_run_completed',
        label: 'Dry Run Completed',
        color: '#0369a1',
        bg: '#e0f2fe',
        borderColor: '#bae6fd',
        description: 'Form steps evaluated, filled, and verified without live submission.',
        icon: ShieldCheck,
      };

    case 'submission_attempted':
      return {
        key: 'submission_attempted',
        label: 'Submission Attempted',
        color: '#d97706',
        bg: '#fef3c7',
        borderColor: '#fde68a',
        description: 'Submit triggered; verifying LinkedIn confirmation.',
        icon: Clock,
      };

    case 'submission_failed':
      return {
        key: 'submission_failed',
        label: 'Submission Unverified',
        color: '#dc2626',
        bg: '#fee2e2',
        borderColor: '#fecaca',
        description: 'Submit was clicked, but post-submit confirmation could not be verified.',
        icon: XCircle,
      };

    case 'skipped':
      return {
        key: 'skipped',
        label: 'Skipped',
        color: '#b45309',
        bg: '#fef3c7',
        borderColor: '#fde68a',
        description: 'Job skipped based on blacklists, prior submission, or no Easy Apply.',
        icon: AlertTriangle,
      };

    case 'failed':
      return {
        key: 'failed',
        label: 'Failed',
        color: '#dc2626',
        bg: '#fee2e2',
        borderColor: '#fecaca',
        description: 'Unrecoverable error during browser or form processing.',
        icon: XCircle,
      };

    case 'saved':
      return {
        key: 'saved',
        label: 'Saved Shortlist',
        color: '#475569',
        bg: '#f1f5f9',
        borderColor: '#e2e8f0',
        description: 'Saved to candidate shortlist for upcoming automation or review.',
        icon: Bookmark,
      };

    case 'interviewing':
      return {
        key: 'interviewing',
        label: 'Interviewing',
        color: '#7e22ce',
        bg: '#f3e8ff',
        borderColor: '#e9d5ff',
        description: 'Candidate in active interview stages.',
        icon: CalendarCheck,
      };

    case 'offer':
      return {
        key: 'offer',
        label: 'Offer Received',
        color: '#15803d',
        bg: '#dcfce7',
        borderColor: '#86efac',
        description: 'Official employment offer received.',
        icon: Award,
      };

    case 'rejected':
      return {
        key: 'rejected',
        label: 'Rejected',
        color: '#991b1b',
        bg: '#fee2e2',
        borderColor: '#fca5a5',
        description: 'Application was not selected by employer.',
        icon: XCircle,
      };

    case 'withdrawn':
      return {
        key: 'withdrawn',
        label: 'Withdrawn',
        color: '#64748b',
        bg: '#f8fafc',
        borderColor: '#e2e8f0',
        description: 'Application voluntarily withdrawn by candidate.',
        icon: Ban,
      };

    case 'pending':
    default:
      return {
        key: 'pending',
        label: 'Pending Queue',
        color: '#0369a1',
        bg: '#e0f2fe',
        borderColor: '#bae6fd',
        description: 'Queued for processing in search / automation engine.',
        icon: Clock,
      };
  }
}

export type CanonicalRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Normalizes automation run statuses into the canonical set.
 */
export function normalizeRunStatus(status?: string | null): CanonicalRunStatus {
  if (!status) return 'queued';
  const norm = status.trim().toLowerCase();
  if (norm === 'pending' || norm === 'waiting' || norm === 'queued') return 'queued';
  if (norm === 'in_progress' || norm === 'active' || norm === 'running') return 'running';
  if (norm === 'aborted' || norm === 'stopped' || norm === 'cancelled') return 'cancelled';
  if (norm === 'error' || norm === 'failed' || norm === 'needs_reconciliation') return 'failed';
  if (norm === 'success' || norm === 'done' || norm === 'completed') return 'completed';

  const canonicalRuns: CanonicalRunStatus[] = ['queued', 'running', 'completed', 'failed', 'cancelled'];
  if (canonicalRuns.includes(norm as CanonicalRunStatus)) {
    return norm as CanonicalRunStatus;
  }
  return 'running';
}

/**
 * Checks whether an automation run has reached a final terminal state.
 */
export function isTerminalRunStatus(status?: string | null): boolean {
  const norm = normalizeRunStatus(status);
  return norm === 'completed' || norm === 'failed' || norm === 'cancelled';
}

/**
 * Formats duration between run timestamps accurately.
 * For terminal runs (completed/failed/cancelled), never displays 'In progress...'.
 */
export function formatRunDuration(
  startedAt?: string | null,
  completedAt?: string | null,
  status?: string | null,
  createdAt?: string | null
): string {
  const norm = normalizeRunStatus(status);
  const isTerminal = norm === 'completed' || norm === 'failed' || norm === 'cancelled';

  const startMs = startedAt ? new Date(startedAt).getTime() : (createdAt ? new Date(createdAt).getTime() : 0);
  const endMs = completedAt ? new Date(completedAt).getTime() : 0;

  if (startMs > 0 && endMs > 0 && endMs >= startMs) {
    const diffMs = endMs - startMs;
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    if (mins > 0) return `${mins} min ${secs} sec`;
    return `${secs} sec`;
  }

  if (isTerminal) {
    return '< 1 min';
  }

  if (norm === 'running' && startMs > 0) {
    const diffMs = Math.max(0, Date.now() - startMs);
    const mins = Math.floor(diffMs / 60000);
    const secs = Math.floor((diffMs % 60000) / 1000);
    if (mins > 0) return `${mins} min ${secs} sec`;
    return `${secs} sec`;
  }

  if (norm === 'queued') {
    return 'Waiting to start';
  }

  return 'In progress…';
}

/**
 * Returns UI metadata for automation execution runs.
 */
export function getRunStatusMeta(status?: string | null): StatusMeta {
  const canonical = normalizeRunStatus(status);

  switch (canonical) {
    case 'running':
      return {
        key: 'running',
        label: 'Running',
        color: '#0284c7',
        bg: '#e0f2fe',
        borderColor: '#bae6fd',
        description: 'Automation runner actively inspecting LinkedIn and applying.',
        icon: Play,
      };

    case 'completed':
      return {
        key: 'completed',
        label: 'Completed',
        color: '#15803d',
        bg: '#dcfce7',
        borderColor: '#bbf7d0',
        description: 'Automation run completed successfully with verified telemetry.',
        icon: CheckCircle2,
      };

    case 'failed':
      return {
        key: 'failed',
        label: 'Failed',
        color: '#dc2626',
        bg: '#fee2e2',
        borderColor: '#fecaca',
        description: 'Automation stopped due to an error or session exception.',
        icon: XCircle,
      };

    case 'cancelled':
      return {
        key: 'cancelled',
        label: 'Cancelled',
        color: '#64748b',
        bg: '#f1f5f9',
        borderColor: '#e2e8f0',
        description: 'Automation run was stopped by user request.',
        icon: Ban,
      };

    case 'queued':
    default:
      return {
        key: 'queued',
        label: 'Queued',
        color: '#d97706',
        bg: '#fef3c7',
        borderColor: '#fde68a',
        description: 'Queued in background task runner.',
        icon: RotateCcw,
      };
  }
}
