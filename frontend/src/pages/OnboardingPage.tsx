import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  AlertCircle,
  Loader2,
  Sparkles,
  Info,
  LogOut,
} from 'lucide-react';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { FormField } from '../components/auth/FormField';
import { useAuth } from '../context/AuthContext';
import { useProfile } from '../context/ProfileContext';
import { authService } from '../services/authService';

interface OnboardingPageProps {
  onSuccess: () => void;
  onSignOut?: () => void;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onSuccess, onSignOut }) => {
  const { user } = useAuth();
  const { profile, completeOnboarding } = useProfile();

  // Initial defaults from auth user or existing profile
  const initialName =
    profile?.first_name && profile?.last_name
      ? `${profile.first_name} ${profile.last_name}`
      : profile?.first_name ||
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        '';

  const [fullName, setFullName] = useState(initialName);
  const [headline, setHeadline] = useState(profile?.headline || '');
  const [targetRole, setTargetRole] = useState(profile?.target_role || '');
  const [experienceYears, setExperienceYears] = useState<number | string>(
    profile?.experience_years ?? 0
  );
  const [city, setCity] = useState(profile?.city || '');
  const [country, setCountry] = useState(profile?.country || 'India');
  const [phone, setPhone] = useState(profile?.phone || '');

  // Validation & interaction states
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (initialName && !fullName) {
      setFullName(initialName);
    }
  }, [initialName]);

  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'fullName':
        if (!String(value).trim()) return 'Full name is required.';
        if (String(value).trim().length < 2) return 'Full name must be at least 2 characters.';
        return '';

      case 'headline':
        if (!String(value).trim()) return 'Professional title is required.';
        if (String(value).trim().length < 2) return 'Title must be at least 2 characters.';
        return '';

      case 'targetRole':
        if (!String(value).trim()) return 'Target role or job search goal is required.';
        if (String(value).trim().length < 2) return 'Target role must be at least 2 characters.';
        return '';

      case 'experienceYears':
        const num = Number(value);
        if (isNaN(num) || num < 0) return 'Please enter valid years of experience (0 or higher).';
        if (num > 60) return 'Please enter a realistic number of years.';
        return '';

      default:
        return '';
    }
  };

  const handleBlur = (field: string, value: any) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const errorMsg = validateField(field, value);
    setErrors((prev) => ({ ...prev, [field]: errorMsg }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError(null);

    const nameErr = validateField('fullName', fullName);
    const headErr = validateField('headline', headline);
    const targetErr = validateField('targetRole', targetRole);
    const expErr = validateField('experienceYears', experienceYears);

    const newErrors = {
      fullName: nameErr,
      headline: headErr,
      targetRole: targetErr,
      experienceYears: expErr,
    };

    setErrors(newErrors);
    setTouched({
      fullName: true,
      headline: true,
      targetRole: true,
      experienceYears: true,
    });

    if (nameErr || headErr || targetErr || expErr) {
      return;
    }

    setIsSubmitting(true);

    try {
      const parts = fullName.trim().split(' ');
      const firstName = parts[0] || 'Candidate';
      const lastName = parts.slice(1).join(' ') || '';

      await completeOnboarding({
        full_name: fullName.trim(),
        first_name: firstName,
        last_name: lastName,
        headline: headline.trim(),
        target_role: targetRole.trim(),
        experience_years: Number(experienceYears) || 0,
        city: city.trim() || undefined,
        country: country.trim() || 'India',
        phone: phone.trim() || undefined,
      });

      onSuccess();
    } catch (err: any) {
      console.error('Failed to complete candidate profile onboarding:', err);
      setGeneralError(
        err.message ||
          'Failed to save your initial profile. Please check your network and try again.'
      );
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    await authService.signOut();
    if (onSignOut) {
      onSignOut();
    } else {
      window.location.href = '/login';
    }
  };

  return (
    <div className="onboarding-page-container">
      {/* Top Navbar */}
      <header className="onboarding-topbar">
        <div className="onboarding-topbar-inner">
          <RolePilotLogo variant="compact" height={34} transparent />
          <div className="onboarding-topbar-actions">
            <span className="onboarding-user-email">{user?.email}</span>
            <button
              type="button"
              onClick={handleSignOut}
              className="onboarding-signout-btn"
              title="Sign out"
            >
              <LogOut size={15} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="onboarding-main">
        <div className="onboarding-card">
          {/* Header Banner */}
          <div className="onboarding-card-header">
            <div className="onboarding-step-pill">
              <Sparkles size={13} color="#1769E8" />
              <span>Initial Profile Setup &bull; Step 1 of 1</span>
            </div>
            <h1 className="onboarding-title">Welcome to RolePilot</h1>
            <p className="onboarding-subtitle">
              Set up your candidate profile in 60 seconds to personalize your job search and
              application workflow.
            </p>
          </div>

          {/* Alert Error */}
          {generalError && (
            <div role="alert" className="auth-alert auth-alert-error" style={{ marginBottom: '20px' }}>
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>{generalError}</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="onboarding-form">
            <div className="onboarding-form-grid">
              {/* Full Name */}
              <div className="onboarding-grid-full">
                <FormField
                  id="onboarding-fullname"
                  label="Full Name"
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={fullName}
                  error={touched.fullName ? errors.fullName : undefined}
                  onChange={(e) => setFullName(e.target.value)}
                  onBlur={(e) => handleBlur('fullName', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Current Title / Headline */}
              <div className="onboarding-grid-half">
                <FormField
                  id="onboarding-headline"
                  label="Professional Title / Current Role"
                  type="text"
                  required
                  placeholder="e.g. Senior Full Stack Engineer"
                  helperText="Your current or most recent job title"
                  value={headline}
                  error={touched.headline ? errors.headline : undefined}
                  onChange={(e) => setHeadline(e.target.value)}
                  onBlur={(e) => handleBlur('headline', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Primary Target Role */}
              <div className="onboarding-grid-half">
                <FormField
                  id="onboarding-target-role"
                  label="Primary Target Role"
                  type="text"
                  required
                  placeholder="e.g. Lead React Developer"
                  helperText="The type of job you want to discover next"
                  value={targetRole}
                  error={touched.targetRole ? errors.targetRole : undefined}
                  onChange={(e) => setTargetRole(e.target.value)}
                  onBlur={(e) => handleBlur('targetRole', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Experience Years */}
              <div className="onboarding-grid-third">
                <FormField
                  id="onboarding-experience"
                  label="Years of Experience"
                  type="number"
                  required
                  min={0}
                  max={50}
                  placeholder="0"
                  value={String(experienceYears)}
                  error={touched.experienceYears ? errors.experienceYears : undefined}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  onBlur={(e) => handleBlur('experienceYears', e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* City */}
              <div className="onboarding-grid-third">
                <FormField
                  id="onboarding-city"
                  label="City"
                  type="text"
                  placeholder="e.g. Bengaluru"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Country */}
              <div className="onboarding-grid-third">
                <FormField
                  id="onboarding-country"
                  label="Country"
                  type="text"
                  placeholder="e.g. India"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Phone (Optional) */}
              <div className="onboarding-grid-full">
                <FormField
                  id="onboarding-phone"
                  label="Phone Number (Optional)"
                  type="tel"
                  placeholder="+91 98765 43210"
                  helperText="Used for contact during application submissions"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Information Notice */}
            <div className="onboarding-info-banner">
              <Info size={18} color="#1769E8" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div className="onboarding-info-text">
                <strong>Next step:</strong> Once you complete initial setup, you can access your
                Dashboard immediately. Detailed items like uploading your PDF resume, adding skills,
                and LinkedIn integration can be completed at any time in the{' '}
                <strong>Profile & Automation Readiness</strong> tab.
              </div>
            </div>

            {/* Actions */}
            <div className="onboarding-actions">
              <button
                type="submit"
                className="onboarding-submit-btn"
                disabled={isSubmitting}
                id="complete-onboarding-btn"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="spin-animation" />
                    <span>Saving your profile...</span>
                  </>
                ) : (
                  <>
                    <span>Complete Setup & Launch Dashboard</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};
