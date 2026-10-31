import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  User,
  Briefcase,
  FileText,
  Play,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Bell,
  CheckCircle,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../Modal';
import { RolePilotLogo } from '../common/RolePilotLogo';
import { useNavigate } from '../../context/NavigationContext';
import { NotificationPanel } from '../notifications/NotificationPanel';
import { fetchUnreadCount } from '../../api/notifications';


export type TabType = 'dashboard' | 'profile' | 'jobs' | 'applications' | 'automation' | 'settings';

interface AppLayoutProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  onNavigate?: (path: string) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onTabChange,
  onNavigate,
  children,
}) => {
  const { email, isAuthenticated, logout } = useAuth();
  const routerNavigate = useNavigate();
  const doNavigate = onNavigate || routerNavigate;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount().then(setUnreadCount).catch(() => {});
      const interval = setInterval(() => {
        fetchUnreadCount().then(setUnreadCount).catch(() => {});
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);


  const navItems = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profile' as TabType, label: 'Profile', icon: User },
    { id: 'jobs' as TabType, label: 'Jobs', icon: Briefcase },
    { id: 'applications' as TabType, label: 'Applications', icon: FileText },
    { id: 'automation' as TabType, label: 'Automation', icon: Play },
  ];

  const handleTabClick = (tab: TabType) => {
    onTabChange(tab);
    setIsMobileMenuOpen(false);
  };

  // User initials & display name
  const userInitials = email ? email.substring(0, 2).toUpperCase() : 'JS';
  const displayEmail = email || 'janmejaysingh331@gmail.com';

  return (
    <div className="saas-app-layout">
      {/* Mobile Drawer Backdrop */}
      {isMobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar (Desktop Persistent / Mobile Drawer) */}
      <aside className={`saas-sidebar ${isMobileMenuOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div
            onClick={() => {
              if (currentTab === 'dashboard') {
                doNavigate('/');
              } else {
                handleTabClick('dashboard');
              }
            }}
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
            title="Click to visit RolePilot Home"
            aria-label="RolePilot Home"
          >
            <RolePilotLogo variant="compact" height={36} whiteText alt="RolePilot — Your Career. Your Next Move." />
          </div>

          {/* Mobile Close X Button */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="mobile-sidebar-close-btn"
            aria-label="Close sidebar menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleTabClick(item.id)}
                className={`sidebar-nav-btn ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <button
            onClick={() => {
              setIsSettingsOpen(true);
              onTabChange('settings');
              setIsMobileMenuOpen(false);
              doNavigate('/settings');
            }}
            className={`sidebar-footer-btn ${currentTab === 'settings' ? 'active' : ''}`}
            aria-label="Settings"
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>

          {isAuthenticated ? (
            <button
              onClick={() => {
                logout();
                setIsMobileMenuOpen(false);
                doNavigate('/');
              }}
              className="sidebar-footer-btn danger"
            >
              <LogOut size={18} />
              <span>Sign Out</span>
            </button>
          ) : (
            <div className="sidebar-auth-hint">Not authenticated</div>
          )}
        </div>
      </aside>


      {/* Main Content Area */}
      <div className="saas-main-wrapper">
        {/* Top Header Bar */}
        <header className="saas-top-header">
          <div className="top-header-left">
            {/* Hamburger button for mobile/tablet */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="mobile-hamburger-btn"
              aria-label="Open sidebar menu"
            >
              <Menu size={22} />
            </button>

            {/* Global Search Bar */}
            <div className="top-search-bar">
              <Search size={16} className="top-search-icon" />
              <input
                type="text"
                placeholder="Search jobs, applications, or runs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="top-search-input"
              />
            </div>
          </div>

          {/* Top Header Right: Notification Bell & User Avatar */}
          <div className="top-header-right" style={{ position: 'relative' }}>
            <button
              className={`icon-action-btn notification-btn ${isNotificationOpen ? 'active' : ''}`}
              title="Notifications"
              aria-label="View notifications"
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              aria-expanded={isNotificationOpen}
            >
              <Bell size={18} />
              {unreadCount > 0 ? (
                <span className="notification-badge-pill" aria-label={`${unreadCount} unread notifications`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              ) : (
                <span className="notification-dot" />
              )}
            </button>

            {/* Notification Flyout Panel */}
            <NotificationPanel
              isOpen={isNotificationOpen}
              onClose={() => setIsNotificationOpen(false)}
              onNotificationClick={(link) => {
                if (link) {
                  if (link.startsWith('/settings')) {
                    onTabChange('settings');
                    doNavigate('/settings');
                  } else if (link.startsWith('/automation')) {
                    onTabChange('automation');
                    doNavigate('/automation');
                  } else if (link.startsWith('/applications')) {
                    onTabChange('applications');
                    doNavigate('/applications');
                  } else if (link.startsWith('/jobs')) {
                    onTabChange('jobs');
                    doNavigate('/jobs');
                  } else if (link.startsWith('/profile')) {
                    onTabChange('profile');
                    doNavigate('/profile');
                  } else {
                    doNavigate(link);
                  }
                }
              }}
              onCountChange={setUnreadCount}
            />

            {/* User Avatar Chip -> User clicked right profile icon redirects to Settings */}
            <div
              className="user-avatar-chip"
              onClick={() => {
                onTabChange('settings');
                doNavigate('/settings');
              }}
              title={displayEmail}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onTabChange('settings');
                  doNavigate('/settings');
                }
              }}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              aria-label="Account Settings"
            >
              <div className="avatar-circle" style={{ backgroundColor: '#8B5CF6', color: '#ffffff', fontWeight: 800 }}>
                {userInitials}
              </div>
              <span className="avatar-email-label" style={{ fontWeight: 600, fontSize: '0.86rem', color: 'var(--text-main)' }}>
                Janmejay Singh
              </span>
              <ChevronDown size={14} color="var(--text-muted)" />
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="saas-page-content">{children}</main>
      </div>

      {/* Mobile Ergonomic Bottom Navigation Bar (Screens <= 768px) */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`mobile-nav-item ${isActive ? 'active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="mobile-nav-icon-container">
                <Icon size={20} />
              </div>
              <span className="mobile-nav-label">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Quick Settings & Navigation Modal (Lightweight entry point to Settings) */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Quick Settings & Account"
        maxWidth="500px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* User Session Info */}
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="avatar-circle" style={{ width: '42px', height: '42px', fontSize: '1.05rem', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: 800 }}>
                {userInitials}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  {email || 'Authenticated User'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                  <CheckCircle size={13} /> Active Supabase Session
                </div>
              </div>
            </div>
          </div>

          {/* Primary Action: Go to Full Settings Page */}
          <button
            onClick={() => {
              onTabChange('settings');
              setIsSettingsOpen(false);
              doNavigate('/settings');
            }}
            className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '0.94rem' }}
          >
            <Settings size={17} />
            <span>Open Dedicated Settings Page</span>
          </button>

          {/* Quick Section Shortcuts */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Settings Sections
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {[
                { label: 'Profile & Identity', tab: 'settings' as TabType },
                { label: 'Security & Password', tab: 'settings' as TabType },
                { label: 'LinkedIn Connection', tab: 'settings' as TabType },
                { label: 'Live System Health', tab: 'settings' as TabType },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    onTabChange(item.tab);
                    setIsSettingsOpen(false);
                    doNavigate('/settings');
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '8px 10px', justifyContent: 'flex-start', textAlign: 'left' }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {/* Legal & Support Links */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px', borderRadius: 'var(--radius-md)', backgroundColor: '#f8fafc', border: '1px solid var(--border-light)', fontSize: '0.84rem' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Legal &amp; Support</span>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <a
                href="/terms"
                onClick={(e) => {
                  e.preventDefault();
                  setIsSettingsOpen(false);
                  doNavigate('/terms');
                }}
                style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
              >
                Terms
              </a>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <a
                href="/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  setIsSettingsOpen(false);
                  doNavigate('/privacy');
                }}
                style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
              >
                Privacy
              </a>
              <span style={{ color: 'var(--text-muted)' }}>•</span>
              <a
                href="/support"
                onClick={(e) => {
                  e.preventDefault();
                  setIsSettingsOpen(false);
                  doNavigate('/support');
                }}
                style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}
              >
                Support
              </a>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-light)', paddingTop: '14px' }}>
            {isAuthenticated && (
              <button
                onClick={async () => {
                  await logout();
                  setIsSettingsOpen(false);
                  doNavigate('/');
                }}
                className="btn btn-outline"
                style={{ color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
              >
                <LogOut size={15} />
                <span>Sign Out</span>
              </button>
            )}
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="btn btn-secondary"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
