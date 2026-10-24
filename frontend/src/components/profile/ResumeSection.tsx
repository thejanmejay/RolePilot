import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  CheckCircle2,
  Eye,
  RefreshCw,
  Trash2,
  FileCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { Resume } from '../../types/profile';
import { profileApi } from '../../api/profile';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';
import { Modal } from '../Modal';

interface ResumeSectionProps {
  resumes: Resume[];
  onResumesChanged: () => void;
}

export const ResumeSection: React.FC<ResumeSectionProps> = ({
  resumes,
  onResumesChanged,
}) => {
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [viewingResume, setViewingResume] = useState<Resume | null>(null);
  const [resumeToDelete, setResumeToDelete] = useState<Resume | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active resume is either flagged is_active or the latest version
  const activeResume = resumes.find((r) => r.is_active) || resumes[0];
  const previousVersions = resumes.filter((r) => r.id !== activeResume?.id);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showError('Please upload a PDF document (.pdf).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('File size exceeds 10MB limit.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsUploading(true);
    try {
      await profileApi.uploadResume(file);
      showSuccess(`Resume "${file.name}" uploaded, parsed, and activated!`);
      onResumesChanged();
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteResume = async () => {
    if (!resumeToDelete) return;
    setIsDeleting(true);
    try {
      await profileApi.deleteResume(resumeToDelete.id);
      showSuccess('Resume deleted.');
      setResumeToDelete(null);
      onResumesChanged();
    } catch (err) {
      showError(formatErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return 'Recently';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return isoStr;
    }
  };

  // Helper to extract parsed highlights
  const getParsedHighlights = (resume: Resume) => {
    const highlights: { label: string; value: string }[] = [];
    if (resume.parsed_data) {
      const data = resume.parsed_data;
      if (data.name) highlights.push({ label: 'Candidate', value: String(data.name) });
      if (data.email) highlights.push({ label: 'Email', value: String(data.email) });
      if (data.phone) highlights.push({ label: 'Phone', value: String(data.phone) });
      if (Array.isArray(data.skills) && data.skills.length > 0) {
        highlights.push({
          label: 'Skills Detected',
          value: `${data.skills.slice(0, 5).join(', ')}${data.skills.length > 5 ? ` +${data.skills.length - 5} more` : ''}`,
        });
      }
      if (data.total_experience_years != null) {
        highlights.push({
          label: 'Experience',
          value: `${data.total_experience_years} years`,
        });
      }
    }
    return highlights;
  };

  return (
    <div className="card" id="resume-section" style={{ marginBottom: '24px' }}>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
      />

      <div className="card-header" style={{ flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 className="card-title">
            <FileText size={20} color="var(--primary)" />
            <span>Resume Management</span>
            {resumes.length > 0 && (
              <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-subtle)', marginLeft: '4px' }}>
                ({resumes.length} {resumes.length === 1 ? 'version' : 'versions'})
              </span>
            )}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            The active PDF resume is attached automatically during Easy Apply submissions.
          </p>
        </div>

        <div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="btn btn-outline"
            style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Upload size={14} className={isUploading ? 'spin' : ''} />
            <span>{isUploading ? 'Uploading & Parsing...' : resumes.length === 0 ? 'Upload Resume' : 'Replace Resume'}</span>
          </button>
        </div>
      </div>

      <div className="card-body">
        {!activeResume ? (
          <div
            className="empty-state"
            style={{
              padding: '36px 20px',
              border: '2px dashed var(--border-light)',
              borderRadius: 'var(--radius-md)',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
            }}
          >
            <FileText size={44} style={{ color: 'var(--text-subtle)', marginBottom: '12px' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
              No Active Resume Configured
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px', maxWidth: '420px', margin: '0 auto 16px auto' }}>
              An active PDF resume is a <strong>mandatory blocker</strong> for automated applications. Please upload your current CV.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="btn btn-primary"
            >
              <Upload size={16} />
              <span>{isUploading ? 'Processing PDF...' : 'Upload PDF Resume'}</span>
            </button>
          </div>
        ) : (
          <div>
            {/* Active Resume Card */}
            <div
              style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid #bbf7d0',
                borderRadius: 'var(--radius-md)',
                padding: '20px',
                background: 'linear-gradient(180deg, rgba(34, 197, 94, 0.04) 0%, var(--bg-card) 100%)',
                boxShadow: 'var(--shadow-sm)',
                marginBottom: previousVersions.length > 0 ? '20px' : '0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  flexWrap: 'wrap',
                  gap: '14px',
                  marginBottom: '16px',
                }}
              >
                {/* Left: File icon + File Name + Badges */}
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: '46px',
                      height: '46px',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(34, 197, 94, 0.12)',
                      color: 'var(--success)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <FileCheck size={24} />
                  </div>

                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          backgroundColor: 'var(--success-bg)',
                          color: 'var(--success)',
                          border: '1px solid #bbf7d0',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          textTransform: 'uppercase',
                        }}
                      >
                        <CheckCircle2 size={12} />
                        Active Resume
                      </span>

                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                          color: 'var(--text-muted)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        Version {activeResume.version || 1}
                      </span>

                      {activeResume.parsed_text ? (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            color: 'var(--primary)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Sparkles size={12} />
                          Parsed Successfully
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                          Raw Text Stored
                        </span>
                      )}
                    </div>

                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)', margin: '0 0 4px 0', wordBreak: 'break-all' }}>
                      {activeResume.file_name}
                    </h3>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={13} />
                        Uploaded: {formatDate(activeResume.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setViewingResume(activeResume)}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="View extracted resume content and parsed fields"
                  >
                    <Eye size={14} />
                    <span>View</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="btn btn-outline"
                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Upload and activate a newer version"
                  >
                    <RefreshCw size={14} className={isUploading ? 'spin' : ''} />
                    <span>Replace</span>
                  </button>

                  <button
                    onClick={() => setResumeToDelete(activeResume)}
                    className="btn-icon"
                    title="Delete resume"
                    aria-label={`Delete ${activeResume.file_name}`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Parsed Fields Summary */}
              {(() => {
                const highlights = getParsedHighlights(activeResume);
                if (highlights.length === 0 && !activeResume.parsed_text) return null;

                return (
                  <div
                    style={{
                      borderTop: '1px solid var(--border-light)',
                      paddingTop: '12px',
                      marginTop: '12px',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '8px' }}>
                      Extracted Profile Metadata
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {highlights.map((h, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: '0.8rem',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-light)',
                            padding: '4px 10px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span style={{ fontWeight: 600, color: 'var(--text-subtle)' }}>{h.label}:</span>
                          <span style={{ color: 'var(--text-main)' }}>{h.value}</span>
                        </div>
                      ))}

                      {activeResume.parsed_text && highlights.length === 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {activeResume.parsed_text.slice(0, 140)}...
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Previous Versions (if any) */}
            {previousVersions.length > 0 && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-subtle)', marginBottom: '8px' }}>
                  Previous Resume Versions
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {previousVersions.map((prev) => (
                    <div
                      key={prev.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 14px',
                        border: '1px solid var(--border-light)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FileText size={16} color="var(--text-subtle)" />
                        <div>
                          <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{prev.file_name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-subtle)', marginLeft: '8px' }}>
                            (v{prev.version || 1} • {formatDate(prev.created_at)})
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => setViewingResume(prev)}
                          className="btn btn-ghost"
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        >
                          View
                        </button>
                        <button
                          onClick={() => setResumeToDelete(prev)}
                          className="btn-icon"
                          title="Delete previous version"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* View Parsed Resume Modal */}
      <Modal
        isOpen={Boolean(viewingResume)}
        onClose={() => setViewingResume(null)}
        title={`Resume Inspection: ${viewingResume?.file_name}`}
      >
        {viewingResume && (
          <div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <span className="badge badge-primary">Version {viewingResume.version}</span>
              <span className={viewingResume.is_active ? 'badge badge-success' : 'badge'}>
                {viewingResume.is_active ? 'Active' : 'Archived'}
              </span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                Uploaded: {formatDate(viewingResume.created_at)}
              </span>
            </div>

            {viewingResume.parsed_data && Object.keys(viewingResume.parsed_data).length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                  Extracted JSON Fields
                </h4>
                <pre
                  style={{
                    backgroundColor: 'var(--bg-subtle, #f8fafc)',
                    border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px',
                    fontSize: '0.8rem',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {JSON.stringify(viewingResume.parsed_data, null, 2)}
                </pre>
              </div>
            )}

            <div>
              <h4 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>
                Extracted Text Content
              </h4>
              <pre
                style={{
                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  border: '1px solid var(--border-light)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  fontSize: '0.8rem',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  lineHeight: '1.4',
                }}
              >
                {viewingResume.parsed_text || 'No extracted text available for this document.'}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button onClick={() => setViewingResume(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Resume Modal */}
      <Modal isOpen={Boolean(resumeToDelete)} onClose={() => setResumeToDelete(null)} title="Delete Resume">
        <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '16px' }}>
          Are you sure you want to delete <strong>{resumeToDelete?.file_name}</strong>?
          {resumeToDelete?.is_active && (
            <span style={{ display: 'block', color: 'var(--danger)', marginTop: '8px' }}>
              Warning: This is your currently active resume. Deleting it will block automation runs until a replacement is uploaded.
            </span>
          )}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={() => setResumeToDelete(null)} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDeleteResume}
            disabled={isDeleting}
            className="btn btn-primary"
            style={{ backgroundColor: 'var(--danger)', borderColor: 'var(--danger)' }}
          >
            {isDeleting ? 'Deleting...' : 'Delete Resume'}
          </button>
        </div>
      </Modal>
    </div>
  );
};
