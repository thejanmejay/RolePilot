import React, { useState } from 'react';
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
  Shield,
  Database,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../Modal';

export type TabType = 'dashboard' | 'profile' | 'jobs' | 'applications' | 'automation';

interface AppLayoutProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  currentTab,
  onTabChange,
  children,
}) => {
  const { email, isAuthenticated, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
            onClick={() => handleTabClick('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
          >
            <div className="brand-logo-badge" style={{ backgroundColor: '#0A66C2', color: '#ffffff' }}>in</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="brand-title">JobHunter</span>
                <span className="brand-pill" style={{ backgroundColor: 'rgba(233, 154, 50, 0.25)', color: 'var(--amber-primary)', border: '1px solid rgba(233, 154, 50, 0.5)' }}>PRO</span>
              </div>
            </div>
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
              setIsMobileMenuOpen(false);
            }}
            className="sidebar-footer-btn"
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>

          {isAuthenticated ? (
            <button
              onClick={() => {
                logout();
                setIsMobileMenuOpen(false);
                window.history.pushState(null, '', '/');
                window.dispatchEvent(new PopStateEvent('popstate'));
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
          <div className="top-header-right">
            <button
              className="icon-action-btn notification-btn"
              title="Notifications"
              aria-label="View notifications"
            >
              <Bell size={18} />
              <span className="notification-dot" />
            </button>

            {/* User Avatar Chip */}
            <div
              className="user-avatar-chip"
              onClick={() => setIsSettingsOpen(true)}
              title={displayEmail}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
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

      {/* Settings Modal (Centered with prominent X close icon) */}
      <Modal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        title="Settings & System Status"
        maxWidth="540px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* User Session Info */}
          <div
            style={{
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: '#f8fafc',
              border: '1px solid var(--border-light)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <div className="avatar-circle" style={{ width: '40px', height: '40px', fontSize: '1rem' }}>
                {userInitials}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                  {email || 'Authenticated User'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle size={13} /> Active Supabase Session
                </div>
              </div>
            </div>
          </div>

          {/* System Services Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Backend Health
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 600 }}>
                <Database size={16} color="var(--primary)" /> Supabase PostgreSQL
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', backgroundColor: 'var(--success-bg)', padding: '3px 8px', borderRadius: 'var(--radius-full)' }}>
                Healthy
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 600 }}>
                <Shield size={16} color="var(--primary)" /> Automation Engine
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', backgroundColor: 'var(--success-bg)', padding: '3px 8px', borderRadius: 'var(--radius-full)' }}>
                Ready (Triple-Key Guard Active)
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
            {isAuthenticated && (
              <button
                onClick={() => {
                  logout();
                  setIsSettingsOpen(false);
                  window.history.pushState(null, '', '/');
                  window.dispatchEvent(new PopStateEvent('popstate'));
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
              className="btn btn-primary"
            >
              Done
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
