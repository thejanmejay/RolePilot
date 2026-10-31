import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ExternalLink,
  Trash2,
  X,
  Sparkles,
} from 'lucide-react';
import type { NotificationItem } from '../../api/notifications';
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  archiveNotification,
} from '../../api/notifications';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationClick?: (link?: string | null) => void;
  onCountChange?: (count: number) => void;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  onNotificationClick,
  onCountChange,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'read' | 'updates'>('all');
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications(filter, 30, 0);
      setNotifications(data.items);
      setUnreadCount(data.unread_count);
      onCountChange?.(data.unread_count);
    } catch (err) {
      console.error('Failed to load notifications', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, filter]);

  // Outside click and escape handler
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      onCountChange?.(0);
    } catch (err) {
      console.error('Failed to mark all as read', err);
    }
  };

  const handleItemClick = async (notif: NotificationItem) => {
    if (!notif.is_read) {
      try {
        await markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
        );
        const newCount = Math.max(0, unreadCount - 1);
        setUnreadCount(newCount);
        onCountChange?.(newCount);
      } catch (err) {
        console.error('Failed to mark notification read', err);
      }
    }
    if (notif.link) {
      onNotificationClick?.(notif.link);
      onClose();
    }
  };

  const handleArchive = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await archiveNotification(id);
      const target = notifications.find((n) => n.id === id);
      if (target && !target.is_read) {
        const newCount = Math.max(0, unreadCount - 1);
        setUnreadCount(newCount);
        onCountChange?.(newCount);
      }
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Failed to archive notification', err);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);
      if (diffSecs < 60) return 'Just now';
      if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
      if (diffSecs < 86400) return `${Math.floor(diffSecs / 3600)}h ago`;
      return `${Math.floor(diffSecs / 86400)}d ago`;
    } catch {
      return '';
    }
  };

  const getIcon = (notif: NotificationItem) => {
    if (notif.type === 'success') {
      return <CheckCircle2 size={16} className="text-emerald-500" />;
    }
    if (notif.type === 'error') {
      return <AlertCircle size={16} className="text-red-500" />;
    }
    if (notif.type === 'warning') {
      return <AlertTriangle size={16} className="text-amber-500" />;
    }
    if (notif.category === 'automation') {
      return <Sparkles size={16} className="text-blue-500" />;
    }
    return <Info size={16} className="text-blue-500" />;
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="notification-panel-flyout"
      role="dialog"
      aria-label="Notifications"
      aria-modal="true"
    >
      {/* Panel Header */}
      <div className="notification-panel-header">
        <div className="notification-header-title-row">
          <div className="notification-title-with-badge">
            <h3 className="notification-panel-title">Notifications</h3>
            {unreadCount > 0 && (
              <span className="notification-unread-pill">
                {unreadCount > 99 ? '99+' : unreadCount} unread
              </span>
            )}
          </div>
          <div className="notification-header-actions">
            {unreadCount > 0 && (
              <button
                type="button"
                className="notification-mark-all-btn"
                onClick={handleMarkAllRead}
                title="Mark all as read"
              >
                <CheckCheck size={14} />
                <span>Mark all read</span>
              </button>
            )}
            <button
              type="button"
              className="notification-close-btn"
              onClick={onClose}
              aria-label="Close notifications"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="notification-filter-pills" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'all'}
            className={`notification-tab-pill ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'unread'}
            className={`notification-tab-pill ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'read'}
            className={`notification-tab-pill ${filter === 'read' ? 'active' : ''}`}
            onClick={() => setFilter('read')}
          >
            Read
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === 'updates'}
            className={`notification-tab-pill ${filter === 'updates' ? 'active' : ''}`}
            onClick={() => setFilter('updates')}
          >
            Updates
          </button>
        </div>
      </div>

      {/* Notification Items List */}
      <div className="notification-items-list" tabIndex={0}>
        {loading && notifications.length === 0 ? (
          <div className="notification-empty-state">
            <div className="notification-spinner" />
            <p>Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="notification-empty-state">
            <Bell size={28} className="notification-empty-icon" />
            <p className="notification-empty-title">
              {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
            </p>
            <p className="notification-empty-desc">
              When automation runs complete or profile status changes, updates will appear here.
            </p>
          </div>
        ) : (
          notifications.map((item) => (
            <div
              key={item.id}
              className={`notification-item-card ${!item.is_read ? 'unread' : 'read'}`}
              onClick={() => handleItemClick(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleItemClick(item);
                }
              }}
            >
              <div className="notification-item-indicator">
                {!item.is_read && <span className="notification-unread-dot" />}
              </div>

              <div className="notification-item-icon-wrapper">
                {getIcon(item)}
              </div>

              <div className="notification-item-body">
                <div className="notification-item-top">
                  <span className="notification-item-title">{item.title}</span>
                  <span className="notification-item-time">
                    {formatRelativeTime(item.created_at)}
                  </span>
                </div>
                <p className="notification-item-msg">{item.message}</p>
                <div className="notification-item-footer">
                  <span className={`notification-category-tag ${item.category}`}>
                    {item.category}
                  </span>
                  {item.link && (
                    <span className="notification-link-hint">
                      View details <ExternalLink size={11} />
                    </span>
                  )}
                </div>
              </div>

              <div className="notification-item-actions">
                <button
                  type="button"
                  className="notification-archive-btn"
                  title="Archive notification"
                  onClick={(e) => handleArchive(e, item.id)}
                  aria-label="Archive notification"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="notification-panel-footer">
        <span className="notification-footer-count">
          {notifications.length} notification{notifications.length !== 1 ? 's' : ''}
        </span>
        {unreadCount > 0 && (
          <button
            type="button"
            className="notification-footer-action-link"
            onClick={handleMarkAllRead}
          >
            Mark all as read
          </button>
        )}
      </div>
    </div>
  );
};
