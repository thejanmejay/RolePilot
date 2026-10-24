import React, { useState } from 'react';
import {
  Briefcase,
  Plus,
  Trash2,
  Calendar,
  AlertCircle,
  MapPin,
  Clock,
  Edit2,
} from 'lucide-react';
import type { Experience, ExperienceCreate } from '../../types/profile';
import { profileApi } from '../../api/profile';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';
import { Modal } from '../Modal';

interface ExperienceSectionProps {
  experiences: Experience[];
  experienceYears?: number | null;
  experienceMonths?: number | null;
  onExperiencesChanged: () => void;
  onTotalExperienceUpdated?: (years: number, months: number) => Promise<void>;
}

export const ExperienceSection: React.FC<ExperienceSectionProps> = ({
  experiences,
  experienceYears = 0,
  experienceMonths = 0,
  onExperiencesChanged,
  onTotalExperienceUpdated,
}) => {
  const { showSuccess, showError } = useToast();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditingTotalExp, setIsEditingTotalExp] = useState(false);
  const [totalYearsInput, setTotalYearsInput] = useState<number>(experienceYears || 0);
  const [totalMonthsInput, setTotalMonthsInput] = useState<number>(experienceMonths || 0);
  const [isSavingTotalExp, setIsSavingTotalExp] = useState(false);

  const [expToDelete, setExpToDelete] = useState<Experience | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form State
  const [companyName, setCompanyName] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isCurrentRole, setIsCurrentRole] = useState(false);
  const [description, setDescription] = useState('');

  const openAddModal = () => {
    setCompanyName('');
    setJobTitle('');
    setLocation('');
    setStartDate('');
    setEndDate('');
    setIsCurrentRole(false);
    setDescription('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setFormError('Company name is required.');
      return;
    }
    if (!jobTitle.trim()) {
      setFormError('Job title is required.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    // Format location into description or handle gracefully
    let finalDesc = description.trim();
    if (location.trim()) {
      finalDesc = finalDesc ? `Location: ${location.trim()}\n\n${finalDesc}` : `Location: ${location.trim()}`;
    }

    const payload: ExperienceCreate = {
      company_name: companyName.trim(),
      job_title: jobTitle.trim(),
      start_date: startDate || null,
      end_date: isCurrentRole ? null : (endDate || null),
      description: finalDesc || null,
    };

    try {
      await profileApi.addExperience(payload);
      showSuccess(`Experience at "${companyName.trim()}" added successfully!`);
      setIsModalOpen(false);
      onExperiencesChanged();
    } catch (err) {
      setFormError(formatErrorMessage(err));
      showError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExperience = async () => {
    if (!expToDelete) return;
    setIsSubmitting(true);
    try {
      await profileApi.deleteExperience(expToDelete.id);
      showSuccess('Experience entry deleted.');
      setExpToDelete(null);
      onExperiencesChanged();
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveTotalExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingTotalExp(true);
    try {
      if (onTotalExperienceUpdated) {
        await onTotalExperienceUpdated(Number(totalYearsInput), Number(totalMonthsInput));
      } else {
        await profileApi.updateProfile({
          experience_years: Number(totalYearsInput),
          experience_months: Number(totalMonthsInput),
        });
        onExperiencesChanged();
      }
      showSuccess('Total experience updated successfully!');
      setIsEditingTotalExp(false);
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsSavingTotalExp(false);
    }
  };

  return (
    <div className="card" id="experience-section" style={{ marginBottom: '24px' }}>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="card-title">
            <Briefcase size={20} color="var(--primary)" />
            <span>Work Experience</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-subtle)', marginLeft: '4px' }}>
              ({experiences.length})
            </span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Heuristics evaluate your total experience and past positions to qualify Easy Apply listings.
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="btn btn-outline"
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          <Plus size={14} />
          <span>Add Experience</span>
        </button>
      </div>

      <div className="card-body">
        {/* Total Experience Highlight Banner */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            padding: '14px 18px',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-light)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Clock size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-subtle)' }}>
                Total Cumulative Experience
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {experienceYears ?? 0} {Number(experienceYears) === 1 ? 'Year' : 'Years'}
                {Number(experienceMonths) > 0 ? ` ${experienceMonths} Months` : ''}
              </div>
            </div>
          </div>

          {!isEditingTotalExp ? (
            <button
              onClick={() => {
                setTotalYearsInput(experienceYears || 0);
                setTotalMonthsInput(experienceMonths || 0);
                setIsEditingTotalExp(true);
              }}
              className="btn btn-ghost"
              style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Edit total experience for heuristic screening"
            >
              <Edit2 size={13} />
              <span>Edit Total Experience</span>
            </button>
          ) : (
            <form
              onSubmit={handleSaveTotalExperience}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={totalYearsInput}
                  onChange={(e) => setTotalYearsInput(Math.max(0, parseInt(e.target.value) || 0))}
                  className="input"
                  style={{ width: '65px', padding: '4px 8px', fontSize: '0.85rem' }}
                  required
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>yrs</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  type="number"
                  min="0"
                  max="11"
                  value={totalMonthsInput}
                  onChange={(e) => setTotalMonthsInput(Math.min(11, Math.max(0, parseInt(e.target.value) || 0)))}
                  className="input"
                  style={{ width: '65px', padding: '4px 8px', fontSize: '0.85rem' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>mos</span>
              </div>

              <button
                type="submit"
                disabled={isSavingTotalExp}
                className="btn btn-primary"
                style={{ fontSize: '0.75rem', padding: '5px 10px' }}
              >
                {isSavingTotalExp ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingTotalExp(false)}
                className="btn btn-ghost"
                style={{ fontSize: '0.75rem', padding: '5px 8px' }}
              >
                Cancel
              </button>
            </form>
          )}
        </div>

        {experiences.length === 0 ? (
          <div className="empty-state">
            <Briefcase size={40} className="empty-state-icon" />
            <p className="empty-state-text">No work experience entries recorded.</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', marginBottom: '16px' }}>
              Add your past and current roles to improve job qualification heuristics and auto-fill responses.
            </p>
            <button onClick={openAddModal} className="btn btn-primary">
              <Plus size={16} />
              <span>Add First Role</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {experiences.map((exp, index) => {
              const isCurrent = !exp.end_date || exp.end_date.toLowerCase() === 'present';
              const dateDisplay = exp.start_date
                ? `${exp.start_date} — ${isCurrent ? 'Present' : exp.end_date}`
                : 'Dates unspecified';

              return (
                <div
                  key={exp.id}
                  style={{
                    display: 'flex',
                    gap: '16px',
                    paddingBottom: index !== experiences.length - 1 ? '18px' : '0',
                    borderBottom: index !== experiences.length - 1 ? '1px solid var(--border-light)' : 'none',
                  }}
                >
                  {/* Timeline icon */}
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      backgroundColor: isCurrent ? 'var(--primary-light)' : 'var(--bg-subtle, #f1f5f9)',
                      color: isCurrent ? 'var(--primary)' : 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Briefcase size={18} />
                  </div>

                  {/* Role Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginBottom: '4px',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                            {exp.job_title}
                          </h3>
                          {isCurrent && (
                            <span
                              style={{
                                fontSize: '0.7rem',
                                fontWeight: 700,
                                backgroundColor: 'var(--success-bg)',
                                color: 'var(--success)',
                                border: '1px solid #bbf7d0',
                                padding: '1px 7px',
                                borderRadius: '10px',
                                textTransform: 'uppercase',
                              }}
                            >
                              Current Role
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--primary)', marginTop: '2px' }}>
                          {exp.company_name}
                        </div>
                      </div>

                      <button
                        onClick={() => setExpToDelete(exp)}
                        className="btn-icon"
                        title="Delete experience"
                        aria-label={`Delete ${exp.job_title} at ${exp.company_name}`}
                        style={{ color: 'var(--text-subtle)' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '14px',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        marginBottom: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} />
                        <span>{dateDisplay}</span>
                      </span>
                    </div>

                    {exp.description && (
                      <p
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-main)',
                          lineHeight: '1.5',
                          margin: 0,
                          whiteSpace: 'pre-line',
                        }}
                      >
                        {exp.description}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Experience Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add Work Experience">
        <form onSubmit={handleSaveExperience}>
          {formError && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="company_name">
                Company Name <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="company_name"
                type="text"
                className="input"
                placeholder="e.g. Acme Technologies"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="job_title">
                Job Title <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                id="job_title"
                type="text"
                className="input"
                placeholder="e.g. Senior QA Automation Engineer"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="role_location">
                Location
              </label>
              <div style={{ position: 'relative' }}>
                <MapPin
                  size={15}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-subtle)',
                  }}
                />
                <input
                  id="role_location"
                  type="text"
                  className="input"
                  style={{ paddingLeft: '34px' }}
                  placeholder="e.g. Noida, India (Hybrid)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
              <input
                id="current_role_toggle"
                type="checkbox"
                checked={isCurrentRole}
                onChange={(e) => {
                  setIsCurrentRole(e.target.checked);
                  if (e.target.checked) setEndDate('');
                }}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <label htmlFor="current_role_toggle" style={{ fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}>
                I currently work in this role
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="start_date">
                  Start Date
                </label>
                <input
                  id="start_date"
                  type="date"
                  className="input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="end_date">
                  End Date
                </label>
                <input
                  id="end_date"
                  type="date"
                  className="input"
                  disabled={isCurrentRole}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  placeholder={isCurrentRole ? 'Present' : ''}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="description">
                Role Description & Key Accomplishments
              </label>
              <textarea
                id="description"
                className="input"
                rows={4}
                placeholder="Key testing frameworks used, test automation pipelines built, and team responsibilities..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={{ resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? 'Saving...' : 'Add Role'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Experience Modal */}
      <Modal isOpen={Boolean(expToDelete)} onClose={() => setExpToDelete(null)} title="Delete Experience Entry">
        <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '16px' }}>
          Are you sure you want to remove your role as <strong>{expToDelete?.job_title}</strong> at{' '}
          <strong>{expToDelete?.company_name}</strong>?
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={() => setExpToDelete(null)} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDeleteExperience}
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            {isSubmitting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </div>
  );
};
