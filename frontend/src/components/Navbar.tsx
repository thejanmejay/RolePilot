import React from 'react';
import {
  LayoutDashboard,
  User,
  Briefcase,
  FileText,
  Play,
  LogOut,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RolePilotLogo } from './common/RolePilotLogo';

export type TabType = 'dashboard' | 'profile' | 'jobs' | 'applications' | 'automation';

interface NavbarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, onTabChange }) => {
  const { email, isAuthenticated, logout } = useAuth();

  const navItems = [
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'profile' as TabType, label: 'Profile', icon: User },
    { id: 'jobs' as TabType, label: 'Jobs', icon: Briefcase },
    { id: 'applications' as TabType, label: 'Applications', icon: FileText },
    { id: 'automation' as TabType, label: 'Automation', icon: Play },
  ];

  return (
    <>
      {/* Top Header Bar */}
      <header
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid var(--border-light)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 16px',
            height: '60px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          {/* Brand Logo & Name */}
          <div
            onClick={() => onTabChange('dashboard')}
            style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', flexShrink: 0 }}
            aria-label="RolePilot Dashboard"
          >
            <RolePilotLogo variant="compact" height={36} alt="RolePilot — Your Career. Your Next Move." />
          </div>

          {/* Desktop Navigation Links (Hidden on Mobile <= 768px via CSS) */}
          <nav className="desktop-nav" style={{ alignItems: 'center', gap: '6px' }}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onTabChange(item.id)}
                  className={`btn ${isActive ? 'btn-primary' : 'btn-outline'}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.85rem',
                    padding: '8px 14px',
                    minHeight: '38px',
                    borderRadius: 'var(--radius-md)',
                  }}
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User profile / Auth status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {isAuthenticated ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  className="user-status-chip"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.78rem',
                    color: 'var(--success)',
                    backgroundColor: 'var(--success-bg)',
                    padding: '5px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontWeight: 600,
                  }}
                >
                  <CheckCircle size={14} />
                  <span className="user-email-text" style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {email || 'Authenticated'}
                  </span>
                </div>

                <button
                  onClick={logout}
                  className="btn-icon"
                  title="Sign Out"
                  aria-label="Sign out"
                  style={{ width: '36px', height: '36px', minWidth: '36px' }}
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Not signed in
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Ergonomic Bottom Navigation Bar (Visible only on Mobile <= 768px via CSS) */}
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
    </>
  );
};
