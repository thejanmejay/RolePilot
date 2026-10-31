import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  X,
  ChevronDown,
  Check,
} from 'lucide-react';

export interface PreferencesData {
  targetRoles: string[];
  preferredLocations: string[];
  workMode: 'Remote' | 'Hybrid' | 'On-site';
  workModes: ('Remote' | 'Hybrid' | 'On-site')[];
  experienceYears?: number;
  experienceLevel: 'Entry (0-2 years)' | 'Mid (2-5 years)' | 'Senior (5+ years)';
  expectedSalary: number;
  expectedSalaryRange?: string;
  noticePeriod: 'Immediate' | '15 Days' | '30 Days' | '60 Days' | '90 Days';
}

export interface SetPreferencesStepProps {
  preferences: PreferencesData;
  onChangePreferences: (prefs: PreferencesData) => void;
  onBack: () => void;
  onContinue: () => void;
  isSubmitting?: boolean;
}

const COMMON_ROLES = [
  'Software Test Engineer',
  'Frontend Developer',
  'Backend Developer',
  'Full Stack Developer',
  'Software Engineer',
  'QA Automation Engineer',
  'DevOps Engineer',
  'Product Manager',
  'Data Analyst',
  'Mobile Developer',
];

const COMMON_LOCATIONS = [
  'Bangalore',
  'Noida',
  'Gurgaon',
  'Delhi NCR',
  'Hyderabad',
  'Pune',
  'Mumbai',
  'Chennai',
  'Remote',
  'San Francisco',
  'London',
];

const SALARY_OPTIONS = [
  { label: '₹ 2,50,000 - ₹ 3,50,000', value: 350000 },
  { label: '₹ 3,50,000 - ₹ 4,50,000', value: 450000 },
  { label: '₹ 4,50,000 - ₹ 5,50,000', value: 550000 },
  { label: '₹ 5,50,000 - ₹ 6,50,000', value: 650000 },
  { label: '₹ 6,50,000 - ₹ 7,50,000', value: 750000 },
  { label: '₹ 7,50,000 - ₹ 8,50,000', value: 850000 },
  { label: '₹ 8,50,000 - ₹ 9,50,000', value: 950000 },
  { label: '₹ 9,50,000 - ₹ 10,50,000', value: 1050000 },
  { label: '₹ 10,50,000 - ₹ 11,50,000', value: 1150000 },
  { label: '₹ 11,50,000 - ₹ 12,50,000', value: 1250000 },
  { label: '₹ 12,50,000 - ₹ 15,00,000', value: 1500000 },
  { label: '₹ 15,00,000 - ₹ 18,00,000', value: 1800000 },
  { label: '₹ 18,00,000 - ₹ 22,00,000', value: 2200000 },
  { label: '₹ 22,00,000 - ₹ 26,00,000', value: 2600000 },
  { label: '₹ 26,00,000 - ₹ 30,00,000', value: 3000000 },
  { label: '₹ 30,00,000+', value: 3500000 },
];

export const SetPreferencesStep: React.FC<SetPreferencesStepProps> = ({
  preferences,
  onChangePreferences,
  onBack,
  onContinue,
  isSubmitting = false,
}) => {
  const [roleInput, setRoleInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Derive initial years from experienceYears or experienceLevel
  const currentYears =
    preferences.experienceYears !== undefined
      ? preferences.experienceYears
      : preferences.experienceLevel?.includes('Entry')
      ? 1
      : preferences.experienceLevel?.includes('Senior')
      ? 6
      : 3;

  // Active work modes fallback
  const activeWorkModes: ('Remote' | 'Hybrid' | 'On-site')[] =
    preferences.workModes && preferences.workModes.length > 0
      ? preferences.workModes
      : preferences.workMode
      ? [preferences.workMode]
      : ['Hybrid'];

  const handleAddRole = (role: string) => {
    const trimmed = role.trim();
    if (!trimmed) return;
    if (!preferences.targetRoles.includes(trimmed)) {
      onChangePreferences({
        ...preferences,
        targetRoles: [...preferences.targetRoles, trimmed],
      });
    }
    setRoleInput('');
    setShowRoleDropdown(false);
    if (validationError) setValidationError(null);
  };

  const handleRemoveRole = (roleToRemove: string) => {
    onChangePreferences({
      ...preferences,
      targetRoles: preferences.targetRoles.filter((r) => r !== roleToRemove),
    });
  };

  const handleAddLocation = (loc: string) => {
    const trimmed = loc.trim();
    if (!trimmed) return;
    if (!preferences.preferredLocations.includes(trimmed)) {
      onChangePreferences({
        ...preferences,
        preferredLocations: [...preferences.preferredLocations, trimmed],
      });
    }
    setLocationInput('');
    setShowLocationDropdown(false);
    if (validationError) setValidationError(null);
  };

  const handleRemoveLocation = (locToRemove: string) => {
    onChangePreferences({
      ...preferences,
      preferredLocations: preferences.preferredLocations.filter((l) => l !== locToRemove),
    });
  };

  // Toggle multi-select work mode
  const handleToggleWorkMode = (mode: 'Remote' | 'Hybrid' | 'On-site') => {
    let nextModes: ('Remote' | 'Hybrid' | 'On-site')[];
    if (activeWorkModes.includes(mode)) {
      if (activeWorkModes.length > 1) {
        nextModes = activeWorkModes.filter((m) => m !== mode);
      } else {
        nextModes = activeWorkModes; // keep at least one selected
      }
    } else {
      nextModes = [...activeWorkModes, mode];
    }
    onChangePreferences({
      ...preferences,
      workModes: nextModes,
      workMode: nextModes[0] || mode,
    });
  };

  // Slider change for experience years
  const handleYearsChange = (years: number) => {
    const level: 'Entry (0-2 years)' | 'Mid (2-5 years)' | 'Senior (5+ years)' =
      years <= 2
        ? 'Entry (0-2 years)'
        : years <= 5
        ? 'Mid (2-5 years)'
        : 'Senior (5+ years)';

    onChangePreferences({
      ...preferences,
      experienceYears: years,
      experienceLevel: level,
    });
  };

  // Expected salary change
  const handleSalaryChange = (val: number) => {
    const chosen = SALARY_OPTIONS.find((s) => s.value === val);
    onChangePreferences({
      ...preferences,
      expectedSalary: val,
      expectedSalaryRange: chosen ? chosen.label : undefined,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (preferences.targetRoles.length === 0) {
      setValidationError('Please select or add at least one target job role.');
      return;
    }
    if (preferences.preferredLocations.length === 0) {
      setValidationError('Please select or add at least one preferred location.');
      return;
    }

    onContinue();
  };

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title & Subtitle */}
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <h1
          style={{
            fontSize: 'clamp(1.4rem, 3.5vw, 1.85rem)',
            fontWeight: 800,
            color: '#101A3A',
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
          }}
        >
          Application Preferences
        </h1>
        <p
          style={{
            fontSize: 'clamp(0.85rem, 2vw, 0.96rem)',
            color: '#64748B',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          Help us find the most relevant job opportunities for you.
        </p>
      </div>

      {validationError && (
        <div
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '10px',
            color: '#DC2626',
            fontSize: '0.88rem',
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{validationError}</span>
        </div>
      )}

      {/* Preferences Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))',
          gap: '16px',
        }}
      >
        {/* CARD 1: Target Job Roles */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: 'clamp(14px, 3vw, 20px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <label style={{ fontSize: '0.86rem', fontWeight: 700, color: '#101A3A' }}>
            Target Job Roles <span style={{ color: '#DC2626' }}>*</span>
          </label>

          {/* Chips & Input Container */}
          <div
            style={{
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '8px 40px 8px 12px',
              backgroundColor: '#FFFFFF',
              minHeight: '44px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              alignItems: 'center',
              position: 'relative',
              boxSizing: 'border-box',
            }}
          >
            {preferences.targetRoles.map((role) => (
              <span
                key={role}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#1E40AF',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  maxWidth: '100%',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveRole(role)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6B7280',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                  title="Remove role"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            <input
              type="text"
              placeholder={preferences.targetRoles.length === 0 ? 'Search or add roles' : ''}
              value={roleInput}
              onChange={(e) => {
                setRoleInput(e.target.value);
                setShowRoleDropdown(true);
              }}
              onFocus={() => setShowRoleDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddRole(roleInput);
                }
              }}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '0.84rem',
                flex: '1 1 120px',
                minWidth: '100px',
                padding: '4px 0',
              }}
            />

            {/* Fixed Chevron Button pinned to top-right so it never shifts down */}
            <button
              type="button"
              onClick={() => setShowRoleDropdown((prev) => !prev)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '10px',
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
              }}
              title="Toggle role options"
            >
              <ChevronDown size={16} />
            </button>

            {/* Suggestions Dropdown */}
            {showRoleDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.1)',
                  zIndex: 20,
                  maxHeight: '180px',
                  overflowY: 'auto',
                }}
              >
                {COMMON_ROLES.filter(
                  (r) =>
                    !preferences.targetRoles.includes(r) &&
                    r.toLowerCase().includes(roleInput.toLowerCase())
                ).map((role) => (
                  <div
                    key={role}
                    onClick={() => handleAddRole(role)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      color: '#1E293B',
                      cursor: 'pointer',
                      borderBottom: '1px solid #F1F5F9',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EFF6FF')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {role}
                  </div>
                ))}
                {roleInput.trim() &&
                  !COMMON_ROLES.map((r) => r.toLowerCase()).includes(roleInput.trim().toLowerCase()) && (
                    <div
                      onClick={() => handleAddRole(roleInput)}
                      style={{
                        padding: '8px 12px',
                        fontSize: '0.84rem',
                        color: '#1769E8',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Add &quot;{roleInput.trim()}&quot;
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* CARD 2: Preferred Locations */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: 'clamp(14px, 3vw, 20px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <label style={{ fontSize: '0.86rem', fontWeight: 700, color: '#101A3A' }}>
            Preferred Locations <span style={{ color: '#DC2626' }}>*</span>
          </label>

          {/* Chips & Input Container */}
          <div
            style={{
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              padding: '8px 40px 8px 12px',
              backgroundColor: '#FFFFFF',
              minHeight: '44px',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              alignItems: 'center',
              position: 'relative',
              boxSizing: 'border-box',
            }}
          >
            {preferences.preferredLocations.map((loc) => (
              <span
                key={loc}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#1E40AF',
                  borderRadius: '6px',
                  padding: '4px 8px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  maxWidth: '100%',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveLocation(loc)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#6B7280',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0,
                  }}
                  title="Remove location"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            <input
              type="text"
              placeholder={preferences.preferredLocations.length === 0 ? 'Search or add locations' : ''}
              value={locationInput}
              onChange={(e) => {
                setLocationInput(e.target.value);
                setShowLocationDropdown(true);
              }}
              onFocus={() => setShowLocationDropdown(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLocation(locationInput);
                }
              }}
              style={{
                border: 'none',
                outline: 'none',
                fontSize: '0.84rem',
                flex: '1 1 120px',
                minWidth: '100px',
                padding: '4px 0',
              }}
            />

            {/* Fixed Chevron Button pinned to top-right so it never shifts down */}
            <button
              type="button"
              onClick={() => setShowLocationDropdown((prev) => !prev)}
              style={{
                position: 'absolute',
                right: '10px',
                top: '10px',
                background: 'none',
                border: 'none',
                color: '#94A3B8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
              }}
              title="Toggle location options"
            >
              <ChevronDown size={16} />
            </button>

            {/* Suggestions Dropdown */}
            {showLocationDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: '4px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  boxShadow: '0 8px 24px -4px rgba(15, 23, 42, 0.1)',
                  zIndex: 20,
                  maxHeight: '180px',
                  overflowY: 'auto',
                }}
              >
                {COMMON_LOCATIONS.filter(
                  (l) =>
                    !preferences.preferredLocations.includes(l) &&
                    l.toLowerCase().includes(locationInput.toLowerCase())
                ).map((loc) => (
                  <div
                    key={loc}
                    onClick={() => handleAddLocation(loc)}
                    style={{
                      padding: '8px 12px',
                      fontSize: '0.84rem',
                      color: '#1E293B',
                      cursor: 'pointer',
                      borderBottom: '1px solid #F1F5F9',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#EFF6FF')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {loc}
                  </div>
                ))}
                {locationInput.trim() &&
                  !COMMON_LOCATIONS.map((l) => l.toLowerCase()).includes(locationInput.trim().toLowerCase()) && (
                    <div
                      onClick={() => handleAddLocation(locationInput)}
                      style={{
                        padding: '8px 12px',
                        fontSize: '0.84rem',
                        color: '#1769E8',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Add &quot;{locationInput.trim()}&quot;
                    </div>
                  )}
              </div>
            )}
          </div>
        </div>

        {/* CARD 3: Work Mode (Multiple Checkbox Selection) */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: 'clamp(14px, 3vw, 20px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <label style={{ fontSize: '0.86rem', fontWeight: 700, color: '#101A3A' }}>
              Work Mode <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <span style={{ fontSize: '0.74rem', color: '#64748B' }}>Multi-select</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {(['Remote', 'Hybrid', 'On-site'] as const).map((mode) => {
              const isSelected = activeWorkModes.includes(mode);
              return (
                <button
                  key={mode}
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => handleToggleWorkMode(mode)}
                  style={{
                    flex: '1 1 85px',
                    minWidth: '85px',
                    height: '42px',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid #1769E8' : '1px solid #CBD5E1',
                    backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                    color: isSelected ? '#1769E8' : '#334155',
                    fontSize: '0.84rem',
                    fontWeight: isSelected ? 700 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    padding: '0 10px',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '4px',
                      border: isSelected ? '2px solid #1769E8' : '1.5px solid #94A3B8',
                      backgroundColor: isSelected ? '#1769E8' : '#FFFFFF',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#FFFFFF',
                      flexShrink: 0,
                    }}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                  <span>{mode}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CARD 4: Experience Level (Interactive Slider) */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: 'clamp(14px, 3vw, 20px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
            <label style={{ fontSize: '0.86rem', fontWeight: 700, color: '#101A3A' }}>
              Experience Level <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: '#1769E8',
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '6px',
                padding: '2px 8px',
              }}
            >
              {currentYears} {currentYears === 1 ? 'Year' : 'Years'} ({preferences.experienceLevel})
            </span>
          </div>

          {/* Interactive Range Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', padding: '4px 0' }}>
              <input
                type="range"
                min={0}
                max={15}
                step={1}
                value={currentYears}
                onChange={(e) => handleYearsChange(Number(e.target.value))}
                aria-label="Experience Level in Years"
                style={{
                  width: '100%',
                  accentColor: '#1769E8',
                  height: '8px',
                  cursor: 'pointer',
                  margin: 0,
                }}
              />
            </div>

            {/* Quick-select tier markers */}
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '6px', flexWrap: 'wrap' }}>
              {(['Entry (0-2 years)', 'Mid (2-5 years)', 'Senior (5+ years)'] as const).map((lvl) => {
                const isSelected = preferences.experienceLevel === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => {
                      const targetYears = lvl.includes('Entry') ? 1 : lvl.includes('Mid') ? 3 : 6;
                      handleYearsChange(targetYears);
                    }}
                    style={{
                      flex: '1 1 auto',
                      padding: '4px 6px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      fontWeight: isSelected ? 700 : 500,
                      border: isSelected ? '1px solid #1769E8' : '1px solid #E2E8F0',
                      backgroundColor: isSelected ? '#EFF6FF' : '#F8FAFC',
                      color: isSelected ? '#1769E8' : '#64748B',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      textAlign: 'center',
                    }}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* CARD 5: Expected Salary (Annual) Range */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: 'clamp(14px, 3vw, 20px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <label style={{ fontSize: '0.86rem', fontWeight: 700, color: '#101A3A' }}>
            Expected Salary (Annual) <span style={{ color: '#DC2626' }}>*</span>
          </label>

          <div style={{ position: 'relative' }}>
            <select
              value={
                SALARY_OPTIONS.some((o) => o.value === preferences.expectedSalary)
                  ? preferences.expectedSalary
                  : SALARY_OPTIONS[0].value
              }
              onChange={(e) => handleSalaryChange(Number(e.target.value))}
              className="input"
              style={{
                width: '100%',
                height: '44px',
                padding: '0 36px 0 14px',
                fontSize: '0.88rem',
                fontWeight: 600,
                color: '#101A3A',
                appearance: 'none',
                borderRadius: '8px',
                backgroundColor: '#FFFFFF',
                boxSizing: 'border-box',
                cursor: 'pointer',
              }}
            >
              {SALARY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={18}
              color="#94A3B8"
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            />
          </div>
        </div>

        {/* CARD 6: Notice Period */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: 'clamp(14px, 3vw, 20px)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <label style={{ fontSize: '0.86rem', fontWeight: 700, color: '#101A3A' }}>
            Notice Period <span style={{ color: '#DC2626' }}>*</span>
          </label>

          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(['Immediate', '15 Days', '30 Days', '60 Days', '90 Days'] as const).map((period) => {
              const isSelected = preferences.noticePeriod === period;
              return (
                <button
                  key={period}
                  type="button"
                  onClick={() => onChangePreferences({ ...preferences, noticePeriod: period })}
                  style={{
                    flex: '1 1 calc(33.33% - 6px)',
                    minWidth: '70px',
                    height: '38px',
                    borderRadius: '20px',
                    border: isSelected ? '2px solid #1769E8' : '1px solid #CBD5E1',
                    backgroundColor: isSelected ? '#EFF6FF' : '#FFFFFF',
                    color: isSelected ? '#1769E8' : '#334155',
                    fontSize: '0.8rem',
                    fontWeight: isSelected ? 700 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                    padding: '0 8px',
                    transition: 'all 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                >
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      border: isSelected ? '3.5px solid #1769E8' : '1.5px solid #94A3B8',
                      backgroundColor: '#FFFFFF',
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ whiteSpace: 'nowrap' }}>{period}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Action Buttons: Responsive for Mobile and Desktop */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          marginTop: '12px',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="btn btn-secondary"
          style={{
            height: '46px',
            padding: '0 20px',
            fontSize: '0.9rem',
            fontWeight: 600,
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            flex: '1 1 110px',
            maxWidth: '180px',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary"
          style={{
            height: '46px',
            padding: '0 28px',
            fontSize: '0.94rem',
            fontWeight: 700,
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            backgroundColor: '#1769E8',
            color: '#FFFFFF',
            flex: '2 1 160px',
            cursor: 'pointer',
          }}
        >
          {isSubmitting ? (
            <span>Saving preferences...</span>
          ) : (
            <>
              <span>Continue</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
