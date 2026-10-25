import React from 'react';
import {
  Compass,
  LayoutGrid,
  Zap,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { RolePilotLogo } from '../common/RolePilotLogo';

export interface AuthBrandBenefit {
  icon: React.ReactNode;
  title: string;
  description: string;
}

export interface AuthBrandPanelProps {
  headline?: string;
  description?: string;
  benefits?: AuthBrandBenefit[];
  trustStatement?: string;
  className?: string;
}

const DEFAULT_BENEFITS: AuthBrandBenefit[] = [
  {
    icon: <Compass size={20} />,
    title: 'Discover relevant job opportunities',
    description:
      'Surface qualified roles matching your verified skills, experience, and targeted career preferences.',
  },
  {
    icon: <LayoutGrid size={20} />,
    title: 'Keep applications and progress organized',
    description:
      'Track application histories, interview stages, and follow-ups in a centralized, clean workspace.',
  },
  {
    icon: <Zap size={20} />,
    title: 'Spend less time on repetitive tasks',
    description:
      'Eliminate duplicate form entries and streamline multi-step application preparation efficiently.',
  },
];

export const AuthBrandPanel: React.FC<AuthBrandPanelProps> = ({
  headline = 'Make your next career move count.',
  description = 'Discover opportunities, streamline applications, and keep your job search organized in one place.',
  benefits = DEFAULT_BENEFITS,
  trustStatement = 'User-controlled application workflows — your career, your rules.',
  className = '',
}) => {
  return (
    <aside className={`signup-split-left ${className}`.trim()} aria-label="RolePilot Overview">
      {/* Brand & Tagline Header */}
      <div className="signup-brand-header">
        <RolePilotLogo variant="compact" height={36} colorMode="dark" transparent />
        <span className="signup-tagline-badge">
          <Sparkles size={13} color="#FFAD18" />
          <span>Your Career. Your Next Move.</span>
        </span>
      </div>

      {/* Main Messaging & Three Benefit Cards */}
      <div className="signup-brand-body">
        <h1 className="signup-brand-headline">{headline}</h1>
        <p className="signup-brand-desc">{description}</p>

        <div className="signup-benefits-list">
          {benefits.map((benefit, index) => (
            <div className="signup-benefit-item" key={index}>
              <div className="signup-benefit-icon-wrapper" aria-hidden="true">
                {benefit.icon}
              </div>
              <div>
                <h3 className="signup-benefit-title">{benefit.title}</h3>
                <p className="signup-benefit-text">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trust & Safe Automation Statement */}
      <div className="signup-brand-footer">
        <ShieldCheck size={16} color="#38BDF8" style={{ flexShrink: 0 }} aria-hidden="true" />
        <span>{trustStatement}</span>
      </div>
    </aside>
  );
};
