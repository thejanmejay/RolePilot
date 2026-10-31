import React, { useState } from 'react';
import {
  User,
  FileText,
  Briefcase,
  Code,
  GraduationCap,
  Award,
  ChevronDown,
  ChevronUp,
  Edit2,
  Plus,
  Trash2,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { Badge } from '../common/Badge';
import { FormField } from '../components/../auth/FormField';
import type {
  ExtractedEducation,
  ExtractedExperience,
  ExtractedSkill,
  ExtractionConflict,
} from '../../types/extraction';

export interface ProfileDraftData {
  fullName: string;
  headline: string;
  targetRole: string;
  experienceYears: number | string;
  city: string;
  country: string;
  phone: string;
  websiteUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  about: string;
  skills: ExtractedSkill[];
  experiences: ExtractedExperience[];
  educations: ExtractedEducation[];
  certifications: Array<{ name: string; issuing_org: string; issue_date?: string }>;
  conflicts: ExtractionConflict[];
  sourceAttribution: Record<string, string>;
  warnings: string[];
}

export interface ReviewProfileStepProps {
  draft: ProfileDraftData;
  onChangeDraft: (draft: ProfileDraftData) => void;
  onBack: () => void;
  onContinue: () => void;
  isSaving?: boolean;
}

export const ReviewProfileStep: React.FC<ReviewProfileStepProps> = ({
  draft,
  onChangeDraft,
  onBack,
  onContinue,
  isSaving = false,
}) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('personal');
  const [newSkillInput, setNewSkillInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const toggleSection = (sectionId: string) => {
    setExpandedSection((prev) => (prev === sectionId ? null : sectionId));
  };

  const handleFieldChange = (field: keyof ProfileDraftData, val: any) => {
    onChangeDraft({
      ...draft,
      [field]: val,
    });
    if (validationErrors[field as string]) {
      setValidationErrors((prev) => {
        const next = { ...prev };
        delete next[field as string];
        return next;
      });
    }
  };

  const handleAddSkill = () => {
    if (newSkillInput.trim()) {
      onChangeDraft({
        ...draft,
        skills: [
          ...draft.skills,
          { name: newSkillInput.trim(), years: 2, months: 0, source: 'user' },
        ],
      });
      setNewSkillInput('');
    }
  };

  const handleRemoveSkill = (index: number) => {
    onChangeDraft({
      ...draft,
      skills: draft.skills.filter((_, idx) => idx !== index),
    });
  };

  const handleUpdateExperience = (index: number, field: string, value: string) => {
    const updated = [...draft.experiences];
    updated[index] = { ...updated[index], [field]: value };
    onChangeDraft({ ...draft, experiences: updated });
  };

  const handleUpdateEducation = (index: number, field: string, value: string) => {
    const updated = [...draft.educations];
    updated[index] = { ...updated[index], [field]: value };
    onChangeDraft({ ...draft, educations: updated });
  };

  const handleAddExperience = () => {
    onChangeDraft({
      ...draft,
      experiences: [
        ...draft.experiences,
        {
          company_name: '',
          job_title: '',
          start_date: '',
          end_date: '',
          description: '',
          source: 'user',
        },
      ],
    });
    setExpandedSection('experience');
  };

  const handleRemoveExperience = (index: number) => {
    onChangeDraft({
      ...draft,
      experiences: draft.experiences.filter((_, idx) => idx !== index),
    });
  };

  const handleAddEducation = () => {
    onChangeDraft({
      ...draft,
      educations: [
        ...draft.educations,
        {
          institution: '',
          degree: '',
          field_of_study: '',
          start_year: '',
          end_year: '',
          source: 'user',
        },
      ],
    });
    setExpandedSection('education');
  };

  const handleRemoveEducation = (index: number) => {
    onChangeDraft({
      ...draft,
      educations: draft.educations.filter((_, idx) => idx !== index),
    });
  };

  const handleUpdateCertification = (index: number, field: string, value: string) => {
    const updated = [...draft.certifications];
    updated[index] = { ...updated[index], [field]: value };
    onChangeDraft({ ...draft, certifications: updated });
  };

  const handleAddCertification = () => {
    onChangeDraft({
      ...draft,
      certifications: [
        ...draft.certifications,
        {
          name: '',
          issuing_org: '',
          issue_date: '',
        },
      ],
    });
    setExpandedSection('certifications');
  };

  const handleRemoveCertification = (index: number) => {
    onChangeDraft({
      ...draft,
      certifications: draft.certifications.filter((_, idx) => idx !== index),
    });
  };

  const handleResolveConflict = (conflictField: string, chosenValue: string) => {
    if (conflictField === 'headline') {
      onChangeDraft({
        ...draft,
        headline: chosenValue,
        targetRole: chosenValue,
        conflicts: draft.conflicts.filter((c) => c.field !== conflictField),
      });
    } else {
      onChangeDraft({
        ...draft,
        conflicts: draft.conflicts.filter((c) => c.field !== conflictField),
      });
    }
  };

  const handleContinue = (e?: React.FormEvent) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    const errors: Record<string, string> = {};

    if (!draft.fullName.trim()) {
      errors.fullName = 'Full name is required.';
    }

    // Auto-populate headline if not extracted from resume rather than blocking the candidate
    let currentHeadline = draft.headline.trim();
    if (!currentHeadline) {
      currentHeadline =
        draft.targetRole.trim() ||
        draft.experiences?.[0]?.job_title?.trim() ||
        (draft.skills && draft.skills.length > 0 ? `${draft.skills[0]} Specialist` : 'Software Professional');
      onChangeDraft({
        ...draft,
        headline: currentHeadline,
        targetRole: draft.targetRole.trim() || currentHeadline,
      });
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      if (errors.fullName) {
        setExpandedSection('personal');
      } else if (errors.headline) {
        setExpandedSection('summary');
      }
      return;
    }

    setValidationErrors({});
    onContinue();
  };

  return (
    <form onSubmit={handleContinue} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Title & Subtitle */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <h1
          style={{
            fontSize: '1.85rem',
            fontWeight: 800,
            color: '#101A3A',
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em',
          }}
        >
          Review Your Profile
        </h1>
        <p
          style={{
            fontSize: '0.96rem',
            color: '#64748B',
            maxWidth: '560px',
            margin: '0 auto',
            lineHeight: 1.5,
          }}
        >
          We've extracted the following information from your resume. Please review and update if needed.
        </p>
      </div>

      {/* Warnings & Notices */}
      {Object.keys(validationErrors).length > 0 && (
        <div
          role="alert"
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            borderRadius: '10px',
            padding: '12px 18px',
            color: '#991B1B',
            fontSize: '0.88rem',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertCircle size={18} color="#DC2626" />
          <span>Please complete the required fields: {Object.values(validationErrors).join(' ')}</span>
        </div>
      )}

      {draft.warnings.length > 0 && (
        <div
          style={{
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '0.84rem',
            color: '#92400E',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          {draft.warnings.map((w, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={15} style={{ flexShrink: 0 }} />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Conflict Resolution Card */}
      {draft.conflicts.length > 0 && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '10px',
            padding: '14px 18px',
          }}
        >
          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#B91C1C', marginBottom: '8px' }}>
            Source Conflict Detected
          </div>
          {draft.conflicts.map((c, idx) => (
            <div key={idx} style={{ fontSize: '0.82rem', color: '#7F1D1D' }}>
              <p style={{ margin: '0 0 8px 0' }}>
                Your resume and portfolio have different titles for <strong>{c.field}</strong>. Which one do you prefer?
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {c.resume_value && (
                  <button
                    type="button"
                    onClick={() => handleResolveConflict(c.field, c.resume_value!)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #B91C1C',
                      backgroundColor: draft.headline === c.resume_value ? '#B91C1C' : '#FFFFFF',
                      color: draft.headline === c.resume_value ? '#FFFFFF' : '#B91C1C',
                      cursor: 'pointer',
                    }}
                  >
                    Use Resume: &quot;{c.resume_value}&quot;
                  </button>
                )}
                {c.portfolio_value && (
                  <button
                    type="button"
                    onClick={() => handleResolveConflict(c.field, c.portfolio_value!)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      borderRadius: '6px',
                      border: '1px solid #0369A1',
                      backgroundColor: draft.headline === c.portfolio_value ? '#0369A1' : '#FFFFFF',
                      color: draft.headline === c.portfolio_value ? '#FFFFFF' : '#0369A1',
                      cursor: 'pointer',
                    }}
                  >
                    Use Portfolio: &quot;{c.portfolio_value}&quot;
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6 Collapsible Section Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* SECTION 1: Personal Information */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            onClick={() => toggleSection('personal')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: expandedSection === 'personal' ? '#F8FAFC' : '#FFFFFF',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#EFF6FF',
                  color: '#1769E8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <User size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#101A3A' }}>
                  Personal Information
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  Name, email, phone, location, links
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Badge variant="success" size="sm">
                Extracted
              </Badge>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '4px 10px', fontSize: '0.76rem', height: '28px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedSection('personal');
                }}
              >
                <Edit2 size={12} style={{ marginRight: '4px' }} />
                <span>Edit</span>
              </button>
              {expandedSection === 'personal' ? <ChevronUp size={18} color="#94A3B8" /> : <ChevronDown size={18} color="#94A3B8" />}
            </div>
          </div>

          {expandedSection === 'personal' && (
            <div style={{ padding: '20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <FormField
                  id="draft-fullname"
                  label="Full Name *"
                  type="text"
                  required
                  placeholder="e.g. Alex Morgan"
                  value={draft.fullName}
                  error={validationErrors.fullName}
                  onChange={(e) => handleFieldChange('fullName', e.target.value)}
                />

                <FormField
                  id="draft-headline"
                  label="Professional Title / Headline *"
                  type="text"
                  required
                  placeholder="e.g. Senior Software Engineer"
                  value={draft.headline}
                  error={validationErrors.headline}
                  onChange={(e) => handleFieldChange('headline', e.target.value)}
                />

                <FormField
                  id="draft-phone"
                  label="Phone Number"
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={draft.phone}
                  onChange={(e) => handleFieldChange('phone', e.target.value)}
                />

                <FormField
                  id="draft-city"
                  label="City"
                  type="text"
                  placeholder="e.g. Bangalore"
                  value={draft.city}
                  onChange={(e) => handleFieldChange('city', e.target.value)}
                />

                <FormField
                  id="draft-country"
                  label="Country"
                  type="text"
                  placeholder="e.g. India"
                  value={draft.country}
                  onChange={(e) => handleFieldChange('country', e.target.value)}
                />

                <FormField
                  id="draft-linkedin"
                  label="LinkedIn Profile"
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={draft.linkedinUrl}
                  onChange={(e) => handleFieldChange('linkedinUrl', e.target.value)}
                />

                <FormField
                  id="draft-github"
                  label="GitHub / Portfolio"
                  type="url"
                  placeholder="https://github.com/username or https://portfolio.site"
                  value={draft.githubUrl || draft.websiteUrl || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    onChangeDraft({
                      ...draft,
                      githubUrl: val,
                      websiteUrl: val.includes('github.com') ? (draft.websiteUrl === draft.githubUrl ? '' : draft.websiteUrl) : val,
                    });
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* SECTION 2: Professional Summary */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            onClick={() => toggleSection('summary')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: expandedSection === 'summary' ? '#F8FAFC' : '#FFFFFF',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#FAF5FF',
                  color: '#9333EA',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileText size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#101A3A' }}>
                  Professional Summary
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  Career summary and key highlights
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Badge variant="success" size="sm">
                Extracted
              </Badge>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '4px 10px', fontSize: '0.76rem', height: '28px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedSection('summary');
                }}
              >
                <Edit2 size={12} style={{ marginRight: '4px' }} />
                <span>Edit</span>
              </button>
              {expandedSection === 'summary' ? <ChevronUp size={18} color="#94A3B8" /> : <ChevronDown size={18} color="#94A3B8" />}
            </div>
          </div>

          {expandedSection === 'summary' && (
            <div style={{ padding: '20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <FormField
                  id="draft-headline"
                  label="Headline / Current Professional Title *"
                  type="text"
                  required
                  placeholder="e.g. Senior Software Engineer"
                  value={draft.headline}
                  error={validationErrors.headline}
                  onChange={(e) => handleFieldChange('headline', e.target.value)}
                />

                <div>
                  <label
                    htmlFor="draft-about"
                    style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
                  >
                    Professional Bio / Summary
                  </label>
                  <textarea
                    id="draft-about"
                    rows={4}
                    value={draft.about}
                    onChange={(e) => handleFieldChange('about', e.target.value)}
                    placeholder="Brief career summary, expertise, and achievements..."
                    className="input"
                    style={{ width: '100%', boxSizing: 'border-box', lineHeight: 1.5, fontSize: '0.86rem' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: Work Experience */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            onClick={() => toggleSection('experience')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: expandedSection === 'experience' ? '#F8FAFC' : '#FFFFFF',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#EFF6FF',
                  color: '#1769E8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Briefcase size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#101A3A' }}>
                  Work Experience
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  {draft.experiences.length} experience {draft.experiences.length === 1 ? 'entry' : 'entries'} found
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Badge variant="success" size="sm">
                Extracted
              </Badge>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '4px 10px', fontSize: '0.76rem', height: '28px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedSection('experience');
                }}
              >
                <Edit2 size={12} style={{ marginRight: '4px' }} />
                <span>Edit</span>
              </button>
              {expandedSection === 'experience' ? <ChevronUp size={18} color="#94A3B8" /> : <ChevronDown size={18} color="#94A3B8" />}
            </div>
          </div>

          {expandedSection === 'experience' && (
            <div style={{ padding: '20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {draft.experiences.map((exp, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '16px 18px',
                      backgroundColor: '#F8FAFC',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1E293B' }}>
                        Experience #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExperience(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#DC2626',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                        }}
                        title="Delete experience"
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                          Job Title *
                        </label>
                        <input
                          type="text"
                          value={exp.job_title}
                          onChange={(e) => handleUpdateExperience(idx, 'job_title', e.target.value)}
                          placeholder="e.g. Software Test Engineer"
                          className="input"
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.86rem', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                          Company Name *
                        </label>
                        <input
                          type="text"
                          value={exp.company_name}
                          onChange={(e) => handleUpdateExperience(idx, 'company_name', e.target.value)}
                          placeholder="e.g. Acme Corp"
                          className="input"
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.86rem', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                          Start Date / Year
                        </label>
                        <input
                          type="text"
                          value={exp.start_date || ''}
                          onChange={(e) => handleUpdateExperience(idx, 'start_date', e.target.value)}
                          placeholder="e.g. 2024-01-01 or Oct 2024"
                          className="input"
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.86rem', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                          End Date (leave blank or 'Present' if current)
                        </label>
                        <input
                          type="text"
                          value={exp.end_date || ''}
                          onChange={(e) => handleUpdateExperience(idx, 'end_date', e.target.value)}
                          placeholder="e.g. Present or 2025-12-31"
                          className="input"
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.86rem', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                        Responsibilities & Achievements
                      </label>
                      <textarea
                        rows={3}
                        value={exp.description || ''}
                        onChange={(e) => handleUpdateExperience(idx, 'description', e.target.value)}
                        placeholder="Key responsibilities, achievements, and tools used..."
                        className="input"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '0.84rem', boxSizing: 'border-box', lineHeight: 1.45 }}
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddExperience}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '6px 14px', alignSelf: 'flex-start' }}
                >
                  <Plus size={14} style={{ marginRight: '4px' }} />
                  <span>Add Experience</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 4: Technical Skills */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            onClick={() => toggleSection('skills')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: expandedSection === 'skills' ? '#F8FAFC' : '#FFFFFF',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#F0FDF4',
                  color: '#16A34A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Code size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#101A3A' }}>
                  Technical Skills
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  {draft.skills.length} skills found
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Badge variant="success" size="sm">
                Extracted
              </Badge>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '4px 10px', fontSize: '0.76rem', height: '28px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedSection('skills');
                }}
              >
                <Edit2 size={12} style={{ marginRight: '4px' }} />
                <span>Edit</span>
              </button>
              {expandedSection === 'skills' ? <ChevronUp size={18} color="#94A3B8" /> : <ChevronDown size={18} color="#94A3B8" />}
            </div>
          </div>

          {expandedSection === 'skills' && (
            <div style={{ padding: '20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                {draft.skills.map((skill, idx) => {
                  const skillName = typeof skill === 'string' ? skill : (skill?.name || '');
                  if (!skillName) return null;
                  return (
                    <span
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#EFF6FF',
                        border: '1px solid #BFDBFE',
                        color: '#1E40AF',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      <span>{skillName}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(idx)}
                        style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: 0 }}
                        title="Remove skill"
                      >
                        &times;
                      </button>
                    </span>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '8px', maxWidth: '400px' }}>
                <input
                  type="text"
                  placeholder="Add skill (e.g. Python, Docker, AWS)"
                  value={newSkillInput}
                  onChange={(e) => setNewSkillInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddSkill();
                    }
                  }}
                  className="input"
                  style={{ fontSize: '0.84rem', padding: '6px 12px' }}
                />
                <button
                  type="button"
                  onClick={handleAddSkill}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '6px 14px' }}
                >
                  <Plus size={14} style={{ marginRight: '4px' }} />
                  <span>Add</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 5: Education */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            onClick={() => toggleSection('education')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: expandedSection === 'education' ? '#F8FAFC' : '#FFFFFF',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#FFFBEB',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <GraduationCap size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#101A3A' }}>
                  Education
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  {draft.educations.length} education {draft.educations.length === 1 ? 'entry' : 'entries'} found
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Badge variant="success" size="sm">
                Extracted
              </Badge>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '4px 10px', fontSize: '0.76rem', height: '28px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedSection('education');
                }}
              >
                <Edit2 size={12} style={{ marginRight: '4px' }} />
                <span>Edit</span>
              </button>
              {expandedSection === 'education' ? <ChevronUp size={18} color="#94A3B8" /> : <ChevronDown size={18} color="#94A3B8" />}
            </div>
          </div>

          {expandedSection === 'education' && (
            <div style={{ padding: '20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {draft.educations.map((edu, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '16px 18px',
                      backgroundColor: '#F8FAFC',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1E293B' }}>
                        Education #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEducation(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#DC2626',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                        }}
                        title="Delete education"
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                          Degree *
                        </label>
                        <input
                          type="text"
                          value={edu.degree || ''}
                          onChange={(e) => handleUpdateEducation(idx, 'degree', e.target.value)}
                          placeholder="e.g. B.Tech, Master, Bachelor"
                          className="input"
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.86rem', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                          Field of Study
                        </label>
                        <input
                          type="text"
                          value={edu.field_of_study || ''}
                          onChange={(e) => handleUpdateEducation(idx, 'field_of_study', e.target.value)}
                          placeholder="e.g. Computer Science, Information Technology"
                          className="input"
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.86rem', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                          Institution / University *
                        </label>
                        <input
                          type="text"
                          value={edu.institution}
                          onChange={(e) => handleUpdateEducation(idx, 'institution', e.target.value)}
                          placeholder="e.g. Stanford University, Mangalmay Institute"
                          className="input"
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.86rem', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                          Graduation Year
                        </label>
                        <input
                          type="text"
                          value={edu.end_year || ''}
                          onChange={(e) => handleUpdateEducation(idx, 'end_year', e.target.value)}
                          placeholder="e.g. 2024"
                          className="input"
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.86rem', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddEducation}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.82rem', padding: '6px 14px', alignSelf: 'flex-start' }}
                >
                  <Plus size={14} style={{ marginRight: '4px' }} />
                  <span>Add Education</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 6: Certifications */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div
            onClick={() => toggleSection('certifications')}
            style={{
              padding: '16px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              backgroundColor: expandedSection === 'certifications' ? '#F8FAFC' : '#FFFFFF',
              transition: 'background-color 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Award size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.96rem', color: '#101A3A' }}>
                  Certifications
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748B' }}>
                  {draft.certifications.length} {draft.certifications.length === 1 ? 'certification' : 'certifications'} found
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Badge variant="success" size="sm">
                Extracted
              </Badge>
              <button
                type="button"
                className="btn btn-outline"
                style={{ padding: '4px 10px', fontSize: '0.76rem', height: '28px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedSection('certifications');
                }}
              >
                <Edit2 size={12} style={{ marginRight: '4px' }} />
                <span>Edit</span>
              </button>
              {expandedSection === 'certifications' ? <ChevronUp size={18} color="#94A3B8" /> : <ChevronDown size={18} color="#94A3B8" />}
            </div>
          </div>

          {expandedSection === 'certifications' && (
            <div style={{ padding: '20px', borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {draft.certifications.map((cert, idx) => (
                  <div
                    key={idx}
                    style={{
                      border: '1px solid #E2E8F0',
                      borderRadius: '10px',
                      padding: '16px 18px',
                      backgroundColor: '#F8FAFC',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#1E293B' }}>
                        Certification #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveCertification(idx)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#DC2626',
                          cursor: 'pointer',
                          padding: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                        }}
                        title="Delete certification"
                      >
                        <Trash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                          Certification Name *
                        </label>
                        <input
                          type="text"
                          value={cert.name || ''}
                          onChange={(e) => handleUpdateCertification(idx, 'name', e.target.value)}
                          placeholder="e.g. AWS Certified Solutions Architect, ISTQB"
                          className="input"
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.86rem', boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                          Issuing Organization *
                        </label>
                        <input
                          type="text"
                          value={cert.issuing_org || ''}
                          onChange={(e) => handleUpdateCertification(idx, 'issuing_org', e.target.value)}
                          placeholder="e.g. Amazon Web Services, Scrum.org"
                          className="input"
                          style={{ width: '100%', padding: '8px 12px', fontSize: '0.86rem', boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>

                    <div style={{ maxWidth: '280px' }}>
                      <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                        Issue Date / Year
                      </label>
                      <input
                        type="text"
                        value={cert.issue_date || ''}
                        onChange={(e) => handleUpdateCertification(idx, 'issue_date', e.target.value)}
                        placeholder="e.g. 2024 or Oct 2023"
                        className="input"
                        style={{ width: '100%', padding: '8px 12px', fontSize: '0.86rem', boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddCertification}
                  className="btn btn-secondary"
                  style={{
                    alignSelf: 'flex-start',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.82rem',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={15} />
                  <span>Add Certification</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons: Back on left, Save & Continue on right */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '12px',
        }}
      >
        <button
          type="button"
          onClick={onBack}
          className="btn btn-secondary"
          style={{
            height: '46px',
            padding: '0 20px',
            fontSize: '0.9rem',
            fontWeight: 600,
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            handleContinue(e);
          }}
          disabled={isSaving}
          className="btn btn-primary"
          id="onboarding-save-and-continue-btn"
          style={{
            height: '46px',
            padding: '0 26px',
            fontSize: '0.94rem',
            fontWeight: 700,
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#1769E8',
            color: '#FFFFFF',
            cursor: isSaving ? 'not-allowed' : 'pointer',
          }}
        >
          <span>Save & Continue</span>
          <ArrowRight size={18} />
        </button>
      </div>
    </form>
  );
};
