import React, { useState } from 'react';
import {
  Terminal,
  RefreshCw,
  AlertCircle,
  Info,
  AlertTriangle,
  Bug,
  Search,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import type { AutomationLog } from '../../types/automation';

interface AutomationLogsViewerProps {
  logs: AutomationLog[];
  isLoading: boolean;
  onRefresh: () => void;
}

export const AutomationLogsViewer: React.FC<AutomationLogsViewerProps> = ({
  logs,
  isLoading,
  onRefresh,
}) => {
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const getLogCategory = (log: AutomationLog): string => {
    const ev = (log.event || '').toUpperCase();
    if (ev.includes('SESSION') || ev.includes('START') || ev.includes('COMPLETE') || ev.includes('INIT')) {
      return 'lifecycle';
    }
    if (ev.includes('NAVIGAT') || ev.includes('SCROLL') || ev.includes('PAGE') || ev.includes('BROWSER')) {
      return 'browser';
    }
    if (ev.includes('MODAL') || ev.includes('STEP') || ev.includes('FIELD') || ev.includes('QUESTION') || ev.includes('RESUME')) {
      return 'form';
    }
    if (ev.includes('SUBMIT') || ev.includes('APPLIED')) {
      return 'submission';
    }
    if (ev.includes('GUARD') || ev.includes('BLOCK') || ev.includes('DRY_RUN') || ev.includes('SAFETY')) {
      return 'safety';
    }
    if (log.level === 'error' || ev.includes('FAIL') || ev.includes('CHECKPOINT')) {
      return 'error';
    }
    return 'other';
  };

  const filteredLogs = logs.filter((log) => {
    // Level filter
    if (levelFilter !== 'all' && (log.level || 'info').toLowerCase() !== levelFilter.toLowerCase()) {
      return false;
    }

    // Category filter
    if (categoryFilter !== 'all') {
      const cat = getLogCategory(log);
      if (cat !== categoryFilter) return false;
    }

    // Text search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchEvent = log.event?.toLowerCase().includes(q);
      const matchMessage = log.message?.toLowerCase().includes(q);
      const matchMetadata = log.metadata_json ? JSON.stringify(log.metadata_json).toLowerCase().includes(q) : false;
      if (!matchEvent && !matchMessage && !matchMetadata) {
        return false;
      }
    }

    return true;
  });

  const getLevelBadge = (level: string) => {
    const norm = (level || 'info').toLowerCase();
    if (norm === 'error') {
      return { bg: '#450a0a', color: '#f87171', border: '#7f1d1d', icon: AlertCircle };
    }
    if (norm === 'warning' || norm === 'warn') {
      return { bg: '#451a03', color: '#fbbf24', border: '#78350f', icon: AlertTriangle };
    }
    if (norm === 'debug') {
      return { bg: '#1e293b', color: '#94a3b8', border: '#334155', icon: Bug };
    }
    return { bg: '#082f49', color: '#38bdf8', border: '#0369a1', icon: Info };
  };

  const handleCopyLog = (log: AutomationLog, e: React.MouseEvent) => {
    e.stopPropagation();
    const payload = JSON.stringify(
      {
        created_at: log.created_at,
        level: log.level,
        event: log.event,
        message: log.message,
        metadata: log.metadata_json,
      },
      null,
      2
    );
    navigator.clipboard.writeText(payload);
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div
      style={{
        backgroundColor: '#090d16',
        borderRadius: 'var(--radius-md)',
        color: '#f8fafc',
        overflow: 'hidden',
        border: '1px solid #1e293b',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      {/* Terminal Toolbar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          backgroundColor: '#0f172a',
          borderBottom: '1px solid #1e293b',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Terminal size={16} color="#38bdf8" />
          <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f1f5f9' }}>
            Telemetry Event Logs
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            ({filteredLogs.length} of {logs.length})
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Level Filter */}
          <select
            value={levelFilter}
            onChange={(e) => setLevelFilter(e.target.value)}
            style={{
              backgroundColor: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 10px',
              fontSize: '0.78rem',
              minHeight: '36px',
            }}
          >
            <option value="all">All Levels</option>
            <option value="info">INFO</option>
            <option value="warning">WARNING</option>
            <option value="error">ERROR</option>
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              backgroundColor: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              borderRadius: 'var(--radius-sm)',
              padding: '6px 10px',
              fontSize: '0.78rem',
              minHeight: '36px',
            }}
          >
            <option value="all">All Categories</option>
            <option value="lifecycle">Lifecycle</option>
            <option value="browser">Browser</option>
            <option value="form">Form Steps</option>
            <option value="submission">Submission</option>
            <option value="safety">Safety Guard</option>
            <option value="error">Errors</option>
          </select>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="btn-icon"
            style={{ color: '#94a3b8', backgroundColor: '#1e293b', border: '1px solid #334155', width: '36px', height: '36px' }}
            title="Refresh Logs"
          >
            <RefreshCw size={14} className={isLoading ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div style={{ padding: '8px 16px', backgroundColor: '#0f172a', borderBottom: '1px solid #1e293b' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }} />
          <input
            type="text"
            placeholder="Search logs by event name, message text, or metadata keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#090d16',
              border: '1px solid #334155',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 12px 8px 32px',
              fontSize: '0.8rem',
              color: '#f1f5f9',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Log Output Stream */}
      <div
        style={{
          maxHeight: '440px',
          overflowY: 'auto',
          padding: '8px 12px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
          fontSize: '0.8rem',
        }}
      >
        {filteredLogs.length === 0 ? (
          <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
            No logs matching current filters.
          </div>
        ) : (
          filteredLogs.map((log) => {
            const badge = getLevelBadge(log.level);
            const isExpanded = expandedLogId === log.id;
            const hasMetadata = Boolean(log.metadata_json && Object.keys(log.metadata_json).length > 0);
            const isCopied = copiedId === log.id;

            return (
              <div
                key={log.id}
                onClick={() => hasMetadata && setExpandedLogId((prev) => (prev === log.id ? null : log.id))}
                style={{
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: isExpanded ? '#1e293b' : 'transparent',
                  borderBottom: '1px solid #172033',
                  cursor: hasMetadata ? 'pointer' : 'default',
                  transition: 'background-color 0.1s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', minWidth: 0, flex: 1 }}>
                    {/* Timestamp */}
                    <span style={{ color: '#64748b', fontSize: '0.72rem', flexShrink: 0, marginTop: '2px' }}>
                      {log.created_at
                        ? new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : '--:--:--'}
                    </span>

                    {/* Level Badge */}
                    <span
                      style={{
                        backgroundColor: badge.bg,
                        color: badge.color,
                        border: `1px solid ${badge.border}`,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '3px',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                      }}
                    >
                      {log.level}
                    </span>

                    {/* Event Name */}
                    <span style={{ color: '#38bdf8', fontWeight: 700, flexShrink: 0, fontSize: '0.78rem' }}>
                      {log.event}:
                    </span>

                    {/* Message */}
                    <span style={{ color: '#cbd5e1', wordBreak: 'break-word', fontSize: '0.78rem' }}>
                      {log.message || 'Event emitted.'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      onClick={(e) => handleCopyLog(log, e)}
                      className="btn-icon"
                      style={{ width: '24px', height: '24px', color: '#64748b', padding: 0 }}
                      title="Copy log entry JSON"
                    >
                      {isCopied ? <Check size={12} color="#4ade80" /> : <Copy size={12} />}
                    </button>

                    {hasMetadata && (
                      <div style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    )}
                  </div>
                </div>

                {/* Expandable Metadata JSON Tree */}
                {isExpanded && hasMetadata && (
                  <div
                    style={{
                      marginTop: '8px',
                      marginLeft: '30px',
                      padding: '8px 10px',
                      backgroundColor: '#090d16',
                      borderRadius: '4px',
                      border: '1px solid #334155',
                      color: '#a5f3fc',
                      fontSize: '0.72rem',
                      overflowX: 'auto',
                    }}
                  >
                    <div style={{ fontSize: '0.68rem', color: '#64748b', marginBottom: '2px', fontWeight: 700 }}>
                      STRUCTURED METADATA
                    </div>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                      {JSON.stringify(log.metadata_json, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
