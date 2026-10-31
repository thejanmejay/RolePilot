import React from 'react';
import { Check, Loader2 } from 'lucide-react';

export type OnboardingStepNumber = 1 | 2 | 3 | 4;

interface OnboardingProgressTrackerProps {
  currentStep: OnboardingStepNumber;
  isExtracting?: boolean;
}

interface StepMeta {
  number: OnboardingStepNumber;
  label: string;
  activeLabel?: string;
}

const STEPS: StepMeta[] = [
  { number: 1, label: 'Add Source' },
  { number: 2, label: 'Review Profile', activeLabel: 'Extracting Information' },
  { number: 3, label: 'Set Preferences' },
  { number: 4, label: 'Complete' },
];

export const OnboardingProgressTracker: React.FC<OnboardingProgressTrackerProps> = ({
  currentStep,
  isExtracting = false,
}) => {
  return (
    <nav
      aria-label="Onboarding Progress"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 20px',
        maxWidth: '820px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <ol
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          listStyle: 'none',
          padding: 0,
          margin: 0,
          flexWrap: 'wrap',
          gap: '8px 12px',
        }}
      >
        {STEPS.map((step, idx) => {
          const isCompleted = currentStep > step.number;
          const isActive = currentStep === step.number;
          const isPending = currentStep < step.number;

          const displayLabel = isActive && isExtracting && step.activeLabel ? step.activeLabel : step.label;

          return (
            <React.Fragment key={step.number}>
              {idx > 0 && (
                <li
                  aria-hidden="true"
                  style={{
                    flex: '1 1 20px',
                    maxWidth: '48px',
                    height: '2px',
                    backgroundColor: isCompleted ? '#16A34A' : '#E2E8F0',
                    transition: 'background-color 0.25s ease',
                  }}
                />
              )}
              <li
                aria-current={isActive ? 'step' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {/* Step Circle Indicator */}
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    transition: 'all 0.2s ease',
                    backgroundColor: isCompleted
                      ? '#16A34A'
                      : isActive
                      ? '#1769E8'
                      : '#F1F5F9',
                    color: isCompleted || isActive ? '#FFFFFF' : '#64748B',
                    border: isPending ? '1px solid #CBD5E1' : 'none',
                    boxShadow: isActive ? '0 0 0 3px rgba(23, 105, 232, 0.18)' : 'none',
                  }}
                >
                  {isCompleted ? (
                    <Check size={14} strokeWidth={3} />
                  ) : isActive && isExtracting ? (
                    <Loader2 size={14} className="spin-animation" />
                  ) : (
                    step.number
                  )}
                </div>

                {/* Step Label */}
                <span
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: isActive ? 700 : 500,
                    color: isCompleted ? '#16A34A' : isActive ? '#1769E8' : '#64748B',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {displayLabel}
                </span>
              </li>
            </React.Fragment>
          );
        })}
      </ol>
    </nav>
  );
};
