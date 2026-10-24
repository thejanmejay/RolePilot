import React, { useState } from 'react';
import { GraduationCap, Plus, Building, Trash2, Calendar, AlertCircle } from 'lucide-react';
import type { Education } from '../../types/profile';
import { profileApi } from '../../api/profile';
import { Modal } from '../Modal';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';

interface EducationSectionProps {
  educations?: Education[];
  onEducationChanged?: () => void;
}

export const EducationSection: React.FC<EducationSectionProps> = ({
  educations = [],
  onEducationChanged,
}) => {
  const { showSuccess, showError } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [eduToDelete, setEduToDelete] = useState<Education | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    institution: '',
    degree: '',
    field_of_study: '',
    start_year: '',
    end_year: '',
    description: '',
  });

  const handleOpenModal = () => {
    setFormData({
      institution: '',
      degree: '',
      field_of_study: '',
      start_year: '',
      end_year: '',
      description: '',
    });
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const inst = formData.institution.trim();
    if (!inst) {
      setErrorMessage('Institution / University name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await profileApi.addEducation({
        institution: inst,
        degree: formData.degree.trim() || undefined,
        field_of_study: formData.field_of_study.trim() || undefined,
        start_year: formData.start_year.trim() || undefined,
        end_year: formData.end_year.trim() || undefined,
        description: formData.description.trim() || undefined,
      });

      showSuccess(`Added "${inst}" to your education records!`);
      setIsModalOpen(false);
      onEducationChanged?.();
    } catch (err) {
      const msg = formatErrorMessage(err);
      setErrorMessage(msg);
      showError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!eduToDelete?.id) return;
    setIsSubmitting(true);
    try {
      await profileApi.deleteEducation(eduToDelete.id);
      showSuccess(`Removed "${eduToDelete.institution}" from education.`);
      setEduToDelete(null);
      onEducationChanged?.();
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card" id="education-section" style={{ marginBottom: '24px' }}>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="card-title">
            <GraduationCap size={20} color="var(--primary)" />
            <span>Education & Degrees</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-subtle)', marginLeft: '4px' }}>
              ({educations.length})
            </span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Academic credentials used during automated LinkedIn Easy Apply questionnaires.
          </p>
        </div>

        <button
          onClick={handleOpenModal}
          className="btn btn-outline"
          style={{ fontSize: '0.8rem', padding: '6px 12px' }}
        >
          <Plus size={14} />
          <span>Add Education</span>
        </button>
      </div>

      <div className="card-body">
        {educations.length === 0 ? (
          <div className="empty-state">
            <GraduationCap size={40} className="empty-state-icon" />
            <p className="empty-state-text">No education added yet.</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', marginBottom: '16px' }}>
              Add your university or degree to ensure the bot can answer degree-level screening questions.
            </p>
            <button onClick={handleOpenModal} className="btn btn-primary">
              <Plus size={16} />
              <span>Add First Education</span>
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {educations.map((edu) => (
              <div
                key={edu.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px',
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  transition: 'border-color var(--transition-fast)',
                }}
              >
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--primary-light)',
                      color: 'var(--primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Building size={20} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: 'var(--text-main)', margin: 0 }}>
                      {edu.institution}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                      {edu.degree && (
                        <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                          {edu.degree}
                        </span>
                      )}
                      {edu.degree && edu.field_of_study && (
                        <span style={{ color: 'var(--border-dark)', fontSize: '0.8rem' }}>•</span>
                      )}
                      {edu.field_of_study && (
                        <span style={{ fontSize: '0.86rem', color: 'var(--text-muted)' }}>
                          {edu.field_of_study}
                        </span>
                      )}
                    </div>
                    {(edu.start_year || edu.end_year) && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                        <Calendar size={12} />
                        <span>
                          {edu.start_year ? edu.start_year : '—'} - {edu.end_year ? edu.end_year : 'Present'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <button
                    onClick={() => setEduToDelete(edu)}
                    className="btn-icon"
                    title="Delete education"
                    aria-label={`Delete ${edu.institution}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Education Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Add Education"
        maxWidth="540px"
      >
        <form onSubmit={handleSave}>
          {errorMessage && (
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
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="edu-institution">
              School / University <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="edu-institution"
              type="text"
              required
              value={formData.institution}
              onChange={(e) => setFormData((prev) => ({ ...prev, institution: e.target.value }))}
              className="form-input"
              placeholder="e.g. Stanford University or Delhi University"
              autoFocus
            />
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="edu-degree">
              Degree
            </label>
            <input
              id="edu-degree"
              type="text"
              value={formData.degree}
              onChange={(e) => setFormData((prev) => ({ ...prev, degree: e.target.value }))}
              className="form-input"
              placeholder="e.g. Bachelor of Technology (B.Tech) or Master of Science"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="edu-field">
              Field of Study
            </label>
            <input
              id="edu-field"
              type="text"
              value={formData.field_of_study}
              onChange={(e) => setFormData((prev) => ({ ...prev, field_of_study: e.target.value }))}
              className="form-input"
              placeholder="e.g. Computer Science, Information Technology"
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '12px',
              marginBottom: '20px',
            }}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="edu-start-year">
                Start Year
              </label>
              <input
                id="edu-start-year"
                type="text"
                value={formData.start_year}
                onChange={(e) => setFormData((prev) => ({ ...prev, start_year: e.target.value }))}
                className="form-input"
                placeholder="e.g. 2020"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edu-end-year">
                End Year (or Expected)
              </label>
              <input
                id="edu-end-year"
                type="text"
                value={formData.end_year}
                onChange={(e) => setFormData((prev) => ({ ...prev, end_year: e.target.value }))}
                className="form-input"
                placeholder="e.g. 2024"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? 'Saving...' : 'Add Education'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(eduToDelete)}
        onClose={() => setEduToDelete(null)}
        title="Delete Education"
        maxWidth="440px"
      >
        <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '18px' }}>
          Are you sure you want to remove <strong>{eduToDelete?.institution}</strong> from your profile?
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            onClick={() => setEduToDelete(null)}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            {isSubmitting ? 'Deleting...' : 'Delete Education'}
          </button>
        </div>
      </Modal>
    </div>
  );
};
