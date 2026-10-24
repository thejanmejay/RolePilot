import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { Modal } from '../Modal';
import { jobsApi } from '../../api/jobs';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';
import type { SearchConfigCreate } from '../../types/job';

interface SearchConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigCreated: () => void;
}

export const SearchConfigModal: React.FC<SearchConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigCreated,
}) => {
  const { showSuccess, showError } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<SearchConfigCreate>({
    name: 'Automation Search Config',
    keywords: ['Selenium', 'SDET', 'QA Automation'],
    location: 'India',
    job_type: 'full-time',
    experience_level: 'mid-senior,associate',
    remote_type: '',
    date_posted: 'past-week',
    easy_apply_only: true,
    max_jobs: 50,
    is_active: true,
  });

  const [keywordsText, setKeywordsText] = useState('Selenium, SDET, QA Automation');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const parsedKeywords = keywordsText
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      await jobsApi.createSearchConfig({
        ...formData,
        keywords: parsedKeywords,
      });

      showSuccess('Search configuration saved successfully!');
      onConfigCreated();
      onClose();
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configure Job Search Query">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="form-label">Configuration Name *</label>
          <input
            type="text"
            required
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            className="form-input"
            placeholder="e.g. QA Automation India"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Keywords (Comma-separated) *</label>
          <input
            type="text"
            required
            value={keywordsText}
            onChange={(e) => setKeywordsText(e.target.value)}
            className="form-input"
            placeholder="e.g. Selenium, SDET, Playwright"
          />
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Location</label>
            <input
              type="text"
              value={formData.location || ''}
              onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))}
              className="form-input"
              placeholder="e.g. India or Remote"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Date Posted</label>
            <select
              value={formData.date_posted || 'past-week'}
              onChange={(e) => setFormData((p) => ({ ...p, date_posted: e.target.value }))}
              className="form-select"
            >
              <option value="past-24h">Past 24 Hours</option>
              <option value="past-week">Past Week</option>
              <option value="past-month">Past Month</option>
              <option value="anytime">Anytime</option>
            </select>
          </div>
        </div>

        <div className="grid-2">
          <div className="form-group">
            <label className="form-label">Job Type</label>
            <select
              value={formData.job_type || 'full-time'}
              onChange={(e) => setFormData((p) => ({ ...p, job_type: e.target.value }))}
              className="form-select"
            >
              <option value="full-time">Full-time</option>
              <option value="contract">Contract</option>
              <option value="part-time">Part-time</option>
              <option value="internship">Internship</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Max Jobs to Collect</label>
            <input
              type="number"
              min="1"
              max="200"
              value={formData.max_jobs || 50}
              onChange={(e) => setFormData((p) => ({ ...p, max_jobs: Number(e.target.value) }))}
              className="form-input"
            />
          </div>
        </div>

        <div style={{ margin: '12px 0' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={formData.easy_apply_only ?? true}
              onChange={(e) => setFormData((p) => ({ ...p, easy_apply_only: e.target.checked }))}
              style={{ width: '16px', height: '16px' }}
            />
            <span>Easy Apply Jobs Only</span>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            <Check size={16} />
            <span>{isSubmitting ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
