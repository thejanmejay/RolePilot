import React, { useState } from 'react';
import { ArrowRight, PanelRight, X } from 'lucide-react';
import { extensionStoreUrl } from '../../config/extensionAvailability';
import './extension-promotion.css';

interface ExtensionPromotionProps {
  placement: 'marketing' | 'dashboard';
  isAuthenticated?: boolean;
  onboardingComplete?: boolean;
  accountId?: string | null;
  onGetStarted?: () => void;
  onOpenDashboard?: () => void;
  onContinueOnboarding?: () => void;
}

const DISMISSAL_PREFIX = 'rolepilot-extension-promo-dismissed-v1';

export const ExtensionPromotion: React.FC<ExtensionPromotionProps> = ({
  placement,
  isAuthenticated = false,
  onboardingComplete = false,
  accountId,
  onGetStarted,
  onOpenDashboard,
  onContinueOnboarding,
}) => {
  const isDashboard = placement === 'dashboard';
  const dismissalKey = `${DISMISSAL_PREFIX}:${accountId || 'account'}`;
  const [dismissed, setDismissed] = useState(() => {
    if (!isDashboard || typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem(dismissalKey) === 'true';
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    try {
      window.localStorage.setItem(dismissalKey, 'true');
    } catch {
      // Keep the banner dismissible for this view if storage is unavailable.
    }
    setDismissed(true);
  };

  const secondaryAction = isDashboard ? undefined : isAuthenticated ? onOpenDashboard : onGetStarted;
  const secondaryLabel = isAuthenticated ? 'Open dashboard' : 'Get started';
  const continueOnboarding = isDashboard && !onboardingComplete && onContinueOnboarding;

  return (
    <section
      className={`extension-promotion extension-promotion--${placement}`}
      aria-labelledby={`extension-promotion-title-${placement}`}
    >
      {isDashboard && (
        <button
          type="button"
          className="extension-promotion__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss Chrome extension announcement"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}

      <div className="extension-promotion__icon" aria-hidden="true">
        <PanelRight size={22} strokeWidth={1.8} />
      </div>

      <div className="extension-promotion__body">
        <p className="extension-promotion__eyebrow">RolePilot for Chrome</p>
        <h2 id={`extension-promotion-title-${placement}`} className="extension-promotion__title">
          Your job search, right where you work.
        </h2>
        <p className="extension-promotion__description">
          Find relevant opportunities with your saved RolePilot profile and preferences, directly from your browser.
        </p>
        <ul className="extension-promotion__benefits">
          <li>Personalized job searches</li>
          <li>Use your saved profile and preferences</li>
          <li>Review matches and track results in RolePilot</li>
        </ul>
      </div>

      <div className="extension-promotion__actions">
        {extensionStoreUrl ? (
          <a
            className="extension-promotion__button extension-promotion__button--primary"
            href={continueOnboarding ? undefined : extensionStoreUrl}
            target={continueOnboarding ? undefined : '_blank'}
            rel={continueOnboarding ? undefined : 'noopener noreferrer'}
            onClick={continueOnboarding ? onContinueOnboarding : undefined}
          >
            {continueOnboarding ? 'Complete profile setup' : 'Install Chrome Extension'}
            <ArrowRight size={16} aria-hidden="true" />
          </a>
        ) : (
          <span className="extension-promotion__button extension-promotion__button--soon" aria-label="Chrome extension coming soon">
            Coming soon
          </span>
        )}
        {secondaryAction && (
          <button
            className="extension-promotion__button extension-promotion__button--secondary"
            type="button"
            onClick={secondaryAction}
          >
            {secondaryLabel}
          </button>
        )}
      </div>
    </section>
  );
};
