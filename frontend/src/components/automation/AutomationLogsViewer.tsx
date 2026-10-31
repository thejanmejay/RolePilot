import React, { useState, useMemo } from 'react';
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
  X,
  FileCode,
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
  const [expandedLogIds, setExpandedLogIds] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [copiedRawId, setCopiedRawId] = useState<number | null>(null);

  // Categorize log events
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

  // Severity counts for quick pills
  const counts = useMemo(() => {
    let error = 0;
    let warning = 0;
    let info = 0;
    for (const log of logs) {
      const lvl = (log.level || 'info').toLowerCase();
      if (lvl === 'error') error++;
      else if (lvl === 'warning' || lvl === 'warn') warning++;
      else info++;
    }
    return { all: logs.length, error, warning, info };
  }, [logs]);

  // Filtered log items
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Level filter
      if (levelFilter !== 'all') {
        const norm = (log.level || 'info').toLowerCase();
        if (levelFilter === 'warning' && norm !== 'warning' && norm !== 'warn') return false;
        if (levelFilter !== 'warning' && norm !== levelFilter) return false;
      }

      // Category filter
      if (categoryFilter !== 'all') {
        const cat = getLogCategory(log);
        if (cat !== categoryFilter) return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchEvent = log.event?.toLowerCase().includes(q);
        const matchMessage = log.message?.toLowerCase().includes(q);
        const matchMetadata = log.metadata_json
          ? JSON.stringify(log.metadata_json).toLowerCase().includes(q)
          : false;
        if (!matchEvent && !matchMessage && !matchMetadata) {
          return false;
        }
      }

      return true;
    });
  }, [logs, levelFilter, categoryFilter, searchQuery]);

  const toggleExpand = (id: number) => {
    setExpandedLogIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getLevelBadge = (level: string) => {
    const norm = (level || 'info').toLowerCase();
    if (norm === 'error') {
      return { bg: '#450a0a', color: '#f87171', border: '#7f1d1d', icon: AlertCircle, label: 'ERROR' };
    }
    if (norm === 'warning' || norm === 'warn') {
      return { bg: '#451a03', color: '#fbbf24', border: '#78350f', icon: AlertTriangle, label: 'WARN' };
    }
    if (norm === 'debug') {
      return { bg: '#1e293b', color: '#94a3b8', border: '#334155', icon: Bug, label: 'DEBUG' };
    }
    return { bg: '#082f49', color: '#38bdf8', border: '#0369a1', icon: Info, label: 'INFO' };
  };

  const handleCopyLogJson = (log: AutomationLog, e: React.MouseEvent) => {
    e.stopPropagation();
    const payload = JSON.stringify(
      {
        id: log.id,
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

  const handleCopyRawMessage = (log: AutomationLog, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(log.message || '');
    setCopiedRawId(log.id);
    setTimeout(() => setCopiedRawId(null), 2000);
  };

  return (
    <div
      className="automation-logs-viewer"
      style={{
        backgroundColor: '#0a0f1d',
        borderRadius: '12px',
        color: '#f8fafc',
        overflow: 'hidden',
        border: '1px solid #1e293b',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
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
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'rgba(56, 189, 248, 0.1)',
              color: '#38bdf8',
            }}
          >
            <Terminal size={16} />
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#f1f5f9' }}>
              Telemetry Event Logs
            </span>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8', marginLeft: '6px' }}>
              ({filteredLogs.length} of {logs.length} events)
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Quick Severity Pills */}
          <div
            style={{
              display: 'inline-flex',
              gap: '4px',
              backgroundColor: '#0a0f1d',
              padding: '3px',
              borderRadius: '8px',
              border: '1px solid #1e293b',
            }}
          >
            <button
              onClick={() => setLevelFilter('all')}
              style={{
                background: levelFilter === 'all' ? '#1e293b' : 'transparent',
                color: levelFilter === 'all' ? '#f8fafc' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              All ({counts.all})
            </button>
            <button
              onClick={() => setLevelFilter('error')}
              style={{
                background: levelFilter === 'error' ? '#450a0a' : 'transparent',
                color: counts.error > 0 ? '#f87171' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Errors ({counts.error})
            </button>
            <button
              onClick={() => setLevelFilter('warning')}
              style={{
                background: levelFilter === 'warning' ? '#451a03' : 'transparent',
                color: counts.warning > 0 ? '#fbbf24' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Warnings ({counts.warning})
            </button>
            <button
              onClick={() => setLevelFilter('info')}
              style={{
                background: levelFilter === 'info' ? '#082f49' : 'transparent',
                color: levelFilter === 'info' ? '#38bdf8' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Info ({counts.info})
            </button>
          </div>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{
              backgroundColor: '#1e293b',
              color: '#f1f5f9',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '5px 10px',
              fontSize: '0.75rem',
              minHeight: '32px',
              outline: 'none',
              cursor: 'pointer',
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

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="btn-icon"
            style={{
              color: '#94a3b8',
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              width: '32px',
              height: '32px',
              borderRadius: '6px',
            }}
            title="Refresh Logs"
            aria-label="Refresh telemetry logs"
          >
            <RefreshCw size={13} className={isLoading ? 'spin-animation' : ''} />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div
        style={{
          padding: '8px 16px',
          backgroundColor: '#0f172a',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: '10px', top: '10px', color: '#64748b' }}
          />
          <input
            type="text"
            placeholder="Search logs by event name, message text, or metadata keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#0a0f1d',
              border: '1px solid #334155',
              borderRadius: '6px',
              padding: '7px 32px 7px 32px',
              fontSize: '0.78rem',
              color: '#f1f5f9',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '7px',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '2px',
              }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Log Output Stream / Table */}
      <div
        className="custom-scrollbar"
        style={{
          maxHeight: '480px',
          overflowY: 'auto',
          padding: '6px 8px',
          fontSize: '0.8rem',
        }}
      >
        {filteredLogs.length === 0 ? (
          <div
            style={{
              padding: '40px 16px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.84rem',
            }}
          >
            {logs.length === 0
              ? 'No telemetry logs recorded for this execution run yet.'
              : 'No logs match your selected filter criteria.'}
            {searchQuery && (
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: '1px solid #334155',
                    color: '#38bdf8',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                  }}
                >
                  Clear Search
                </button>
              </div>
            )}
          </div>
        ) : (
          filteredLogs.map((log) => {
            const badge = getLevelBadge(log.level);
            const isExpanded = expandedLogIds.has(log.id);
            const hasMetadata = Boolean(log.metadata_json && Object.keys(log.metadata_json).length > 0);
            const message = log.message || '';
            const isMultiLine = message.includes('\n');
            const isLong = message.length > 90;
            const canExpand = isMultiLine || isLong || hasMetadata;

            // Formatted short preview for single-line display
            const firstLine = message.split('\n')[0];
            const shortPreview =
              firstLine.length > 90 ? `${firstLine.substring(0, 90)}…` : firstLine;

            const isCopied = copiedId === log.id;
            const isRawCopied = copiedRawId === log.id;

            return (
              <div
                key={log.id}
                style={{
                  marginBottom: '4px',
                  borderRadius: '6px',
                  backgroundColor: isExpanded
                    ? 'rgba(30, 41, 59, 0.7)'
                    : log.level === 'error'
                    ? 'rgba(69, 10, 10, 0.25)'
                    : log.level === 'warning'
                    ? 'rgba(69, 26, 3, 0.2)'
                    : 'rgba(15, 23, 42, 0.4)',
                  borderLeft: `3px solid ${
                    log.level === 'error'
                      ? '#ef4444'
                      : log.level === 'warning'
                      ? '#f59e0b'
                      : '#0ea5e9'
                  }`,
                  borderTop: '1px solid rgba(255, 255, 255, 0.04)',
                  borderRight: '1px solid rgba(255, 255, 255, 0.04)',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                  transition: 'background-color 0.12s ease',
                }}
              >
                {/* Row Summary Bar */}
                <div
                  onClick={() => canExpand && toggleExpand(log.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    gap: '10px',
                    cursor: canExpand ? 'pointer' : 'default',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      minWidth: 0,
                      flex: 1,
                    }}
                  >
                    {/* Expand Chevron */}
                    {canExpand ? (
                      <div
                        style={{
                          color: '#64748b',
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </div>
                    ) : (
                      <div style={{ width: '14px', flexShrink: 0 }} />
                    )}

                    {/* Timestamp */}
                    <span
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                        color: '#64748b',
                        fontSize: '0.72rem',
                        flexShrink: 0,
                      }}
                    >
                      {log.created_at
                        ? new Date(log.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })
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
                        padding: '1px 5px',
                        borderRadius: '3px',
                        textTransform: 'uppercase',
                        flexShrink: 0,
                        letterSpacing: '0.03em',
                      }}
                    >
                      {badge.label}
                    </span>

                    {/* Event Name */}
                    <span
                      style={{
                        color: '#38bdf8',
                        fontWeight: 700,
                        fontSize: '0.76rem',
                        flexShrink: 0,
                      }}
                    >
                      {log.event}:
                    </span>

                    {/* Short Message Preview */}
                    <span
                      style={{
                        color: log.level === 'error' ? '#fca5a5' : '#cbd5e1',
                        fontSize: '0.76rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      {shortPreview || 'Event logged.'}
                    </span>
                  </div>

                  {/* Actions Right Side */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexShrink: 0,
                    }}
                  >
                    {canExpand && !isExpanded && (
                      <span
                        style={{
                          fontSize: '0.68rem',
                          color: '#38bdf8',
                          backgroundColor: 'rgba(56, 189, 248, 0.1)',
                          padding: '1px 6px',
                          borderRadius: '4px',
                          fontWeight: 600,
                        }}
                      >
                        Details
                      </span>
                    )}

                    <button
                      onClick={(e) => handleCopyLogJson(log, e)}
                      className="btn-icon"
                      style={{
                        width: '24px',
                        height: '24px',
                        color: '#64748b',
                        padding: 0,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      title="Copy complete log event JSON"
                      aria-label="Copy log JSON"
                    >
                      {isCopied ? <Check size={13} color="#4ade80" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>

                {/* Expandable Detailed View Area */}
                {isExpanded && (
                  <div
                    style={{
                      padding: '10px 14px 12px 34px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                      backgroundColor: 'rgba(10, 15, 29, 0.65)',
                    }}
                  >
                    {/* Full Message / Error Trace Box */}
                    <div style={{ marginBottom: hasMetadata ? '10px' : 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '4px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: log.level === 'error' ? '#f87171' : '#94a3b8',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          {log.level === 'error' ? 'Error Details / Stack Trace' : 'Full Message'}
                        </span>

                        <button
                          onClick={(e) => handleCopyRawMessage(log, e)}
                          style={{
                            background: 'transparent',
                            border: '1px solid #334155',
                            color: '#94a3b8',
                            fontSize: '0.68rem',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                          title="Copy raw message text"
                        >
                          {isRawCopied ? (
                            <>
                              <Check size={11} color="#4ade80" />
                              <span style={{ color: '#4ade80' }}>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy Text</span>
                            </>
                          )}
                        </button>
                      </div>

                      <pre
                        className="custom-scrollbar"
                        style={{
                          margin: 0,
                          padding: '10px 12px',
                          backgroundColor: '#050811',
                          borderRadius: '6px',
                          border: `1px solid ${
                            log.level === 'error' ? '#7f1d1d' : '#1e293b'
                          }`,
                          color: log.level === 'error' ? '#fca5a5' : '#e2e8f0',
                          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                          fontSize: '0.74rem',
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          overflowWrap: 'anywhere',
                          maxHeight: '220px',
                          overflowY: 'auto',
                        }}
                      >
                        {message}
                      </pre>
                    </div>

                    {/* Structured Metadata Box */}
                    {hasMetadata && (
                      <div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginBottom: '4px',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            color: '#38bdf8',
                            letterSpacing: '0.04em',
                            textTransform: 'uppercase',
                          }}
                        >
                          <FileCode size={12} />
                          <span>Structured Metadata</span>
                        </div>
                        <pre
                          className="custom-scrollbar"
                          style={{
                            margin: 0,
                            padding: '8px 12px',
                            backgroundColor: '#050811',
                            borderRadius: '6px',
                            border: '1px solid #1e293b',
                            color: '#7dd3fc',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                            fontSize: '0.72rem',
                            lineHeight: 1.45,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxHeight: '160px',
                            overflowY: 'auto',
                          }}
                        >
                          {JSON.stringify(log.metadata_json, null, 2)}
                        </pre>
                      </div>
                    )}
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
