import React, { useState } from 'react';
import {
  Award,
  Plus,
  Trash2,
  Edit3,
  PlusCircle,
  AlertCircle,
  Star,
} from 'lucide-react';
import type { Skill, SkillCreate } from '../../types/profile';
import { profileApi } from '../../api/profile';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';
import { Modal } from '../Modal';

interface SkillsSectionProps {
  skills: Skill[];
  onSkillsChanged: () => void;
}

interface SkillRow {
  name: string;
  years: number;
  months: number;
  rating: number;
}

/** Helper to compute a 1-5 star proficiency rating from years of experience */
function getProficiencyRating(years: number, months = 0): number {
  const totalMonths = years * 12 + months;
  if (totalMonths >= 36) return 5; // 3+ years: Master / Expert
  if (totalMonths >= 24) return 4; // 2+ years: Advanced
  if (totalMonths >= 12) return 3; // 1+ year: Competent
  if (totalMonths >= 6) return 2;  // 6+ months: Intermediate beginner
  return 1;                        // < 6 months: Novice
}

export const SkillsSection: React.FC<SkillsSectionProps> = ({ skills, onSkillsChanged }) => {
  const { showSuccess, showError } = useToast();

  // Modals
  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [skillToDelete, setSkillToDelete] = useState<Skill | null>(null);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Single Form state
  const [singleName, setSingleName] = useState('');
  const [singleYears, setSingleYears] = useState<number>(2);
  const [singleMonths, setSingleMonths] = useState<number>(0);
  const [singleRating, setSingleRating] = useState<number>(4);
  const [singleError, setSingleError] = useState<string | null>(null);

  // Bulk Form state
  const [bulkRows, setBulkRows] = useState<SkillRow[]>([
    { name: '', years: 2, months: 0, rating: 4 },
    { name: '', years: 2, months: 0, rating: 4 },
    { name: '', years: 1, months: 0, rating: 3 },
  ]);
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  // Open Single Skill Modal
  const openSingleModal = (skill?: Skill) => {
    if (skill) {
      setEditingSkill(skill);
      setSingleName(skill.name);
      setSingleYears(skill.years);
      setSingleMonths(skill.months);
      setSingleRating(getProficiencyRating(skill.years, skill.months));
    } else {
      setEditingSkill(null);
      setSingleName('');
      setSingleYears(2);
      setSingleMonths(0);
      setSingleRating(4);
    }
    setSingleError(null);
    setIsSingleModalOpen(true);
  };

  // Open Bulk Modal
  const openBulkModal = () => {
    setBulkRows([
      { name: '', years: 2, months: 0, rating: 4 },
      { name: '', years: 2, months: 0, rating: 4 },
      { name: '', years: 1, months: 0, rating: 3 },
    ]);
    setBulkErrors([]);
    setIsBulkModalOpen(true);
  };

  // Adjust rating dynamically when years change
  const handleYearsChange = (years: number) => {
    setSingleYears(years);
    setSingleRating(getProficiencyRating(years, singleMonths));
  };

  // Set stars explicitly and adjust years benchmark if appropriate
  const handleRatingClick = (rating: number) => {
    setSingleRating(rating);
    // Suggest standard benchmark years if current years don't match
    if (rating === 5 && singleYears < 3) setSingleYears(3);
    else if (rating === 4 && (singleYears < 2 || singleYears >= 3)) setSingleYears(2);
    else if (rating === 3 && (singleYears < 1 || singleYears >= 2)) setSingleYears(1);
    else if (rating === 2 && singleYears > 0) {
      setSingleYears(0);
      setSingleMonths(6);
    }
  };

  // Save Single Skill
  const handleSaveSingleSkill = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = singleName.trim();
    if (!name) {
      setSingleError('Skill name is required.');
      return;
    }
    if (singleYears < 0) {
      setSingleError('Years of experience cannot be negative.');
      return;
    }

    setIsSubmitting(true);
    setSingleError(null);
    try {
      await profileApi.addSkill({
        name,
        years: Number(singleYears),
        months: Number(singleMonths),
      });
      showSuccess(`Skill "${name}" saved successfully!`);
      setIsSingleModalOpen(false);
      onSkillsChanged();
    } catch (err) {
      setSingleError(formatErrorMessage(err));
      showError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save Bulk Skills
  const handleSaveBulkSkills = async (e: React.FormEvent) => {
    e.preventDefault();
    const validSkills: SkillCreate[] = [];
    const errors: string[] = [];

    bulkRows.forEach((row, index) => {
      const name = row.name.trim();
      if (!name) return; // skip empty rows

      if (row.years < 0) {
        errors.push(`Row ${index + 1}: Years cannot be negative.`);
      } else {
        validSkills.push({
          name,
          years: Number(row.years),
          months: Number(row.months || 0),
        });
      }
    });

    if (errors.length > 0) {
      setBulkErrors(errors);
      return;
    }

    if (validSkills.length === 0) {
      setBulkErrors(['Please provide at least one valid skill name.']);
      return;
    }

    setIsSubmitting(true);
    setBulkErrors([]);

    try {
      await profileApi.addSkillsBulk(validSkills);
      showSuccess(`Added ${validSkills.length} skill${validSkills.length === 1 ? '' : 's'} successfully!`);
      setIsBulkModalOpen(false);
      onSkillsChanged();
    } catch (err) {
      showError(formatErrorMessage(err));
      setBulkErrors([formatErrorMessage(err)]);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Skill
  const handleDeleteSkill = async () => {
    if (!skillToDelete) return;
    setIsSubmitting(true);
    try {
      await profileApi.deleteSkill(skillToDelete.id);
      showSuccess(`Skill "${skillToDelete.name}" deleted.`);
      setSkillToDelete(null);
      onSkillsChanged();
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper to render star rating
  const renderStarRating = (rating: number) => {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }} title={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((starIdx) => (
          <Star
            key={starIdx}
            size={14}
            fill={starIdx <= rating ? '#f59e0b' : 'transparent'}
            color={starIdx <= rating ? '#f59e0b' : 'var(--text-subtle)'}
            style={{ opacity: starIdx <= rating ? 1 : 0.4 }}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="card" id="skills-section" style={{ marginBottom: '24px' }}>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="card-title">
            <Award size={20} color="var(--primary)" />
            <span>Technical Skills & Proficiency</span>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-subtle)', marginLeft: '4px' }}>
              ({skills.length})
            </span>
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Heuristic matching uses your skills and years of experience to answer screening questions.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={openBulkModal}
            className="btn btn-secondary"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <PlusCircle size={14} />
            <span>Add Multiple</span>
          </button>

          <button
            onClick={() => openSingleModal()}
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '6px 12px' }}
          >
            <Plus size={14} />
            <span>Add Skill</span>
          </button>
        </div>
      </div>

      <div className="card-body">
        {skills.length === 0 ? (
          <div className="empty-state">
            <Award size={40} className="empty-state-icon" />
            <p className="empty-state-text">No skills added yet.</p>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-subtle)', marginBottom: '16px' }}>
              Add your core skills (e.g. Selenium, Java, SQL, Playwright, API Testing) to enable the LinkedIn Hunter automation engine to answer job questions accurately.
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
              <button onClick={() => openSingleModal()} className="btn btn-primary">
                <Plus size={16} />
                <span>Add First Skill</span>
              </button>
              <button onClick={openBulkModal} className="btn btn-secondary">
                <PlusCircle size={16} />
                <span>Add Multiple Skills</span>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Desktop Table Header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(140px, 2fr) minmax(100px, 1fr) minmax(110px, 1fr) 70px',
                padding: '8px 16px',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: 'var(--text-subtle)',
                borderBottom: '1px solid var(--border-light)',
              }}
              className="skills-table-header"
            >
              <div>Skill</div>
              <div>Experience</div>
              <div>Proficiency</div>
              <div style={{ textAlign: 'right' }}>Actions</div>
            </div>

            {/* Skill Rows */}
            {skills.map((skill) => {
              const rating = getProficiencyRating(skill.years, skill.months);
              const expText =
                skill.years > 0
                  ? `${skill.years} ${skill.years === 1 ? 'year' : 'years'}${skill.months > 0 ? ` ${skill.months}m` : ''}`
                  : `${skill.months || 0} months`;

              return (
                <div
                  key={skill.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(140px, 2fr) minmax(100px, 1fr) minmax(110px, 1fr) 70px',
                    alignItems: 'center',
                    padding: '12px 16px',
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    transition: 'all 0.15s ease',
                  }}
                  className="skill-row-card"
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.92rem' }}>
                    {skill.name}
                  </div>

                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {expText}
                  </div>

                  <div>
                    {renderStarRating(rating)}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                    <button
                      onClick={() => openSingleModal(skill)}
                      className="btn-icon"
                      title="Edit skill"
                      aria-label={`Edit ${skill.name}`}
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      onClick={() => setSkillToDelete(skill)}
                      className="btn-icon"
                      title="Delete skill"
                      aria-label={`Delete ${skill.name}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Single Skill Modal */}
      <Modal
        isOpen={isSingleModalOpen}
        onClose={() => setIsSingleModalOpen(false)}
        title={editingSkill ? `Edit Skill: ${editingSkill.name}` : 'Add New Skill'}
      >
        <form onSubmit={handleSaveSingleSkill}>
          {singleError && (
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
              <span>{singleError}</span>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="skill_name">
              Skill Name <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              id="skill_name"
              type="text"
              className="form-input"
              placeholder="e.g. Selenium, Java, Playwright, SQL, Postman"
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
              disabled={Boolean(editingSkill)} // Key is primary
              required
            />
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div className="form-group">
              <label className="form-label" htmlFor="single_years">
                Years of Experience
              </label>
              <input
                id="single_years"
                type="number"
                min="0"
                max="40"
                className="form-input"
                value={singleYears}
                onChange={(e) => handleYearsChange(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="single_months">
                Months (0-11)
              </label>
              <input
                id="single_months"
                type="number"
                min="0"
                max="11"
                className="form-input"
                value={singleMonths}
                onChange={(e) => setSingleMonths(Math.min(11, Math.max(0, parseInt(e.target.value) || 0)))}
              />
            </div>
          </div>

          {/* Proficiency Star Picker */}
          <div className="form-group" style={{ marginBottom: '20px' }}>
            <label className="form-label">
              Proficiency Rating ({singleRating} / 5 Stars)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => handleRatingClick(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={`Rate ${star} star${star > 1 ? 's' : ''}`}
                >
                  <Star
                    size={22}
                    fill={star <= singleRating ? '#f59e0b' : 'transparent'}
                    color={star <= singleRating ? '#f59e0b' : 'var(--text-subtle)'}
                  />
                </button>
              ))}
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '8px' }}>
                {singleRating === 5
                  ? 'Master / Expert (3+ yrs)'
                  : singleRating === 4
                  ? 'Advanced (2+ yrs)'
                  : singleRating === 3
                  ? 'Competent (1+ yr)'
                  : singleRating === 2
                  ? 'Intermediate (6+ mos)'
                  : 'Novice'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={() => setIsSingleModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? 'Saving...' : editingSkill ? 'Update Skill' : 'Add Skill'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Bulk Skills Modal */}
      <Modal isOpen={isBulkModalOpen} onClose={() => setIsBulkModalOpen(false)} title="Add Multiple Skills">
        <form onSubmit={handleSaveBulkSkills}>
          {bulkErrors.length > 0 && (
            <div
              style={{
                backgroundColor: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                color: 'var(--danger)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.85rem',
                marginBottom: '16px',
              }}
            >
              {bulkErrors.map((err, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <AlertCircle size={14} />
                  <span>{err}</span>
                </div>
              ))}
            </div>
          )}

          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
            Quickly register multiple skills and experience levels. Leave any unused rows empty.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {bulkRows.map((row, index) => (
              <div
                key={index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr',
                  gap: '8px',
                  alignItems: 'center',
                }}
              >
                <input
                  type="text"
                  className="form-input"
                  placeholder={`Skill ${index + 1} (e.g. Selenium)`}
                  value={row.name}
                  onChange={(e) => {
                    const next = [...bulkRows];
                    next[index].name = e.target.value;
                    setBulkRows(next);
                  }}
                />
                <input
                  type="number"
                  min="0"
                  max="40"
                  className="form-input"
                  placeholder="Years"
                  value={row.years}
                  onChange={(e) => {
                    const next = [...bulkRows];
                    next[index].years = Math.max(0, parseInt(e.target.value) || 0);
                    setBulkRows(next);
                  }}
                />
                <input
                  type="number"
                  min="0"
                  max="11"
                  className="form-input"
                  placeholder="Months"
                  value={row.months}
                  onChange={(e) => {
                    const next = [...bulkRows];
                    next[index].months = Math.min(11, Math.max(0, parseInt(e.target.value) || 0));
                    setBulkRows(next);
                  }}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setBulkRows([...bulkRows, { name: '', years: 1, months: 0, rating: 3 }])}
            className="btn btn-ghost"
            style={{ fontSize: '0.8rem', padding: '6px 10px', marginBottom: '16px' }}
          >
            <Plus size={14} />
            <span>Add Another Row</span>
          </button>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={() => setIsBulkModalOpen(false)} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary">
              {isSubmitting ? 'Saving...' : 'Save All Skills'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Skill Modal */}
      <Modal isOpen={Boolean(skillToDelete)} onClose={() => setSkillToDelete(null)} title="Delete Skill">
        <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '16px' }}>
          Are you sure you want to remove <strong>{skillToDelete?.name}</strong> from your profile?
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={() => setSkillToDelete(null)} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDeleteSkill}
            disabled={isSubmitting}
            className="btn btn-primary"
            style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            {isSubmitting ? 'Deleting...' : 'Delete Skill'}
          </button>
        </div>
      </Modal>
    </div>
  );
};
