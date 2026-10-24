import React from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { RolePilotLogo } from '../common/RolePilotLogo';
import './auth.css';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerText: string;
  footerActionText: string;
  onFooterAction: () => void;
  onNavigateHome: () => void;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  title,
  subtitle,
  children,
  footerText,
  footerActionText,
  onFooterAction,
  onNavigateHome,
}) => {
  return (
    <div className="auth-page-wrapper">
      {/* Top Header Navigation */}
      <header className="auth-nav-header">
        <div
          onClick={onNavigateHome}
          className="auth-brand-logo"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onNavigateHome();
            }
          }}
          aria-label="RolePilot Home"
        >
          <RolePilotLogo variant="compact" height={36} alt="RolePilot — Your Career. Your Next Move." />
        </div>

        <button
          onClick={onNavigateHome}
          className="auth-back-link"
          type="button"
        >
          <ArrowLeft size={16} />
          <span>Back to home</span>
        </button>
      </header>

      {/* Main Authentication Card */}
      <main className="auth-card-container">
        <div className="auth-card-header">
          <h1 className="auth-card-title">{title}</h1>
          <p className="auth-card-subtitle">{subtitle}</p>
        </div>

        {children}

        {/* Card Footer (Switch between Signup & Login) */}
        <div className="auth-card-footer">
          <span>{footerText} </span>
          <button
            type="button"
            onClick={onFooterAction}
            className="auth-text-link"
          >
            {footerActionText}
          </button>
        </div>
      </main>

      {/* Global Page Footer */}
      <footer className="auth-page-footer">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ShieldCheck size={14} color="var(--auth-blue)" />
          <span>User-controlled automation — no blind or guaranteed submissions</span>
        </div>
        <div className="auth-footer-links">
          <button type="button" onClick={onNavigateHome}>Privacy Policy</button>
          <span>•</span>
          <button type="button" onClick={onNavigateHome}>Terms of Service</button>
          <span>•</span>
          <button type="button" onClick={onNavigateHome}>Status</button>
        </div>
        <div>
          © {new Date().getFullYear()} RolePilot. All rights reserved.
        </div>
      </footer>
    </div>
  );
};
