import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { AuthBrandPanel } from './AuthBrandPanel';
import './auth.css';

export interface AuthSplitLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footerPromptText: string;
  footerActionText: string;
  onFooterAction: () => void;
  footerActionId?: string;
  onNavigateHome: () => void;
  onNavigateTerms?: () => void;
  onNavigatePrivacy?: () => void;
  brandPanel?: React.ReactNode;
  legalActionText?: string; // e.g. "creating an account" or "signing in"
}

export const AuthSplitLayout: React.FC<AuthSplitLayoutProps> = ({
  title,
  subtitle,
  children,
  footerPromptText,
  footerActionText,
  onFooterAction,
  footerActionId,
  onNavigateHome,
  onNavigateTerms,
  onNavigatePrivacy,
  brandPanel,
  legalActionText = 'creating an account',
}) => {
  return (
    <div className="signup-split-layout">
      {/* Left Promotional & Brand Panel */}
      {brandPanel || <AuthBrandPanel />}

      {/* Right Content / Form Panel */}
      <main className="signup-split-right" id="auth-main-content">
        <div className="signup-form-top-bar">
          <button
            type="button"
            onClick={onNavigateHome}
            className="auth-back-link"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            aria-label="Back to home page"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Back to home</span>
          </button>
        </div>

        <div className="signup-form-card">
          <div className="signup-form-header">
            <h1 className="signup-form-title">{title}</h1>
            <p className="signup-form-subtitle">{subtitle}</p>
          </div>

          {/* Form and Controls */}
          {children}

          {/* Prompt to alternate authentication view (Sign Up <-> Log In) */}
          <div className="signup-login-prompt">
            {footerPromptText}{' '}
            <button
              type="button"
              onClick={onFooterAction}
              className="auth-text-link"
              id={footerActionId}
            >
              {footerActionText}
            </button>
          </div>

          {/* Legal and Compliance Links */}
          <div className="signup-legal-note">
            By {legalActionText}, you agree to RolePilot's{' '}
            <a
              href="/terms"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  onNavigateTerms?.();
                }
              }}
            >
              Terms of Service
            </a>{' '}
            and{' '}
            <a
              href="/privacy"
              onClick={(e) => {
                if (!e.metaKey && !e.ctrlKey) {
                  e.preventDefault();
                  onNavigatePrivacy?.();
                }
              }}
            >
              Privacy Policy
            </a>
            .
          </div>
        </div>
      </main>
    </div>
  );
};
