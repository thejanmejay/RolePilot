import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Upload,
  ZoomIn,
  ZoomOut,
  Download,
  AlertTriangle,
  Loader2,
  ArrowLeft,
  Check,
  X,
} from 'lucide-react';
import type { Resume, ResumeReplacementResponse, ConflictField } from '../../types/profile';
import { profileApi } from '../../api/profile';
import { useToast } from '../../context/ToastContext';
import { formatErrorMessage } from '../../api/client';
import { Modal } from '../Modal';

export interface ResumePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  resume: Resume | null;
  localFile?: File | null;
  onResumesChanged?: () => void;
  onProfileUpdated?: () => void;
}

export const ResumePreviewModal: React.FC<ResumePreviewModalProps> = ({
  isOpen,
  onClose,
  resume,
  localFile,
  onResumesChanged,
  onProfileUpdated,
}) => {
  const { showSuccess, showError } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Document state
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState<boolean>(true);
  const [pdfLoadError, setPdfLoadError] = useState<string | null>(null);

  // Viewer controls
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [currentPage] = useState<number>(1);
  const [showExtractedText, setShowExtractedText] = useState<boolean>(false);

  // Replacement workflow state
  const [isReplacing, setIsReplacing] = useState<boolean>(false);
  const [replaceStep, setReplaceStep] = useState<'idle' | 'uploading' | 'parsing' | 'confirm_diff' | 'activating'>('idle');
  const [replacementData, setReplacementData] = useState<ResumeReplacementResponse | null>(null);
  const [selectedFieldOverrides, setSelectedFieldOverrides] = useState<Record<string, any>>({});
  const [isDuplicateSubmitting, setIsDuplicateSubmitting] = useState<boolean>(false);

  // Active resume being inspected (can update upon successful replacement)
  const [currentResume, setCurrentResume] = useState<Resume | null>(resume);

  useEffect(() => {
    setCurrentResume(resume);
  }, [resume]);

  // Load PDF Blob when modal opens or target resume changes
  useEffect(() => {
    if (!isOpen) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      setIsLoadingPdf(true);
      setPdfLoadError(null);
      setReplaceStep('idle');
      setReplacementData(null);
      return;
    }

    let isMounted = true;
    setIsLoadingPdf(true);
    setPdfLoadError(null);

    // 1. Direct local file preview (e.g. during onboarding)
    if (localFile) {
      try {
        const localUrl = URL.createObjectURL(localFile);
        if (isMounted) {
          setBlobUrl(localUrl);
          setIsLoadingPdf(false);
        }
      } catch (err) {
        if (isMounted) {
          setPdfLoadError('Unable to generate local preview for selected file.');
          setIsLoadingPdf(false);
        }
      }
      return;
    }

    // 2. Persisted resume PDF fetch from authenticated backend
    if (currentResume?.id) {
      profileApi
        .getResumeFileBlob(currentResume.id)
        .then((blob) => {
          if (!isMounted) return;
          if (blob.size === 0) {
            setPdfLoadError('The document binary is empty or unavailable.');
            setIsLoadingPdf(false);
            return;
          }
          const objectUrl = URL.createObjectURL(blob);
          setBlobUrl(objectUrl);
          setIsLoadingPdf(false);
        })
        .catch((err) => {
          if (!isMounted) return;
          setPdfLoadError(
            formatErrorMessage(err) || 'Unable to retrieve document preview from storage.'
          );
          setIsLoadingPdf(false);
        });
    } else {
      setIsLoadingPdf(false);
      setPdfLoadError('No resume document selected.');
    }

    return () => {
      isMounted = false;
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [isOpen, currentResume?.id, localFile]);

  // Zoom handlers
  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 15, 175));
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 15, 60));
  const handleResetZoom = () => setZoomLevel(100);

  // File replacement selection
  const handleTriggerFilePicker = () => {
    if (isReplacing || isDuplicateSubmitting) return;
    fileInputRef.current?.click();
  };

  const handleReplacementFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showError('Please select a valid PDF resume file (.pdf).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showError('Replacement resume exceeds the maximum 10 MB size limit.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsReplacing(true);
    setIsDuplicateSubmitting(true);
    setReplaceStep('uploading');

    try {
      // Step 1: Upload and parse new resume version (draft v+1, keeping current active)
      setReplaceStep('parsing');
      const response = await profileApi.replaceResume(file);
      setReplacementData(response);

      // Pre-select replacement values for conflicting fields by default
      const initialOverrides: Record<string, any> = {};
      if (response.diff.conflicts && response.diff.conflicts.length > 0) {
        response.diff.conflicts.forEach((c) => {
          initialOverrides[c.field] = c.extracted_value;
        });
        setSelectedFieldOverrides(initialOverrides);
      } else {
        setSelectedFieldOverrides({});
      }
      // Explicit candidate confirmation is required for all replacements (never auto-activate)
      setReplaceStep('confirm_diff');
    } catch (err) {
      showError(formatErrorMessage(err));
      setReplaceStep('idle');
    } finally {
      setIsReplacing(false);
      setIsDuplicateSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmActivation = async (
    targetReplacement?: ResumeReplacementResponse,
    fieldOverrides?: Record<string, any>
  ) => {
    const dataToActivate = targetReplacement || replacementData;
    if (!dataToActivate) return;

    setIsReplacing(true);
    setReplaceStep('activating');

    try {
      const overrides = fieldOverrides || selectedFieldOverrides;
      const res = await profileApi.activateResume(dataToActivate.new_resume.id, {
        accepted_fields: overrides,
        add_skills: true,
        add_experiences: true,
        add_educations: true,
        clear_stale_fields: true,
      });

      showSuccess(res.message || `Resume v${res.resume.version} activated and profile synchronized!`);
      setCurrentResume(res.resume);
      setReplaceStep('idle');
      setReplacementData(null);

      // Trigger automatic UI state refresh without page reload
      onResumesChanged?.();
      onProfileUpdated?.();
    } catch (err) {
      showError(formatErrorMessage(err));
      setReplaceStep('confirm_diff');
    } finally {
      setIsReplacing(false);
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

  const displayFileName = localFile ? localFile.name : currentResume?.file_name || 'Resume.pdf';
  const displayVersion = currentResume ? `v${currentResume.version}` : 'Draft';
  const isActive = currentResume?.is_active ?? true;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Resume Document: ${displayFileName}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '560px' }}>
        {/* Hidden System File Picker for Replacement */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          style={{ display: 'none' }}
          onChange={handleReplacementFileSelected}
        />

        {/* Top Header Bar: Metadata & Action Controls */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '12px 16px',
            backgroundColor: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: '10px',
          }}
        >
          {/* Metadata badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '6px',
                backgroundColor: '#EFF6FF',
                color: '#1769C2',
                border: '1px solid #BFDBFE',
              }}
            >
              {displayVersion}
            </span>
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                padding: '3px 9px',
                borderRadius: '6px',
                backgroundColor: isActive ? '#DCFCE7' : '#F1F5F9',
                color: isActive ? '#16A34A' : '#64748B',
                border: isActive ? '1px solid #BBF7D0' : '1px solid #E2E8F0',
              }}
            >
              {isActive ? 'Active Document' : 'Archived Version'}
            </span>
            <span style={{ fontSize: '0.8rem', color: '#64748B', marginLeft: '4px' }}>
              Uploaded: {formatDate(currentResume?.created_at)}
            </span>
          </div>

          {/* Zoom & Page Navigation Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '2px 4px',
              }}
            >
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 60}
                className="btn-icon"
                title="Zoom Out"
                style={{ padding: '4px 6px', border: 'none', background: 'transparent' }}
              >
                <ZoomOut size={15} color="#475569" />
              </button>
              <span
                onClick={handleResetZoom}
                title="Click to reset zoom"
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 600,
                  color: '#334155',
                  padding: '0 6px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                {zoomLevel}%
              </span>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 175}
                className="btn-icon"
                title="Zoom In"
                style={{ padding: '4px 6px', border: 'none', background: 'transparent' }}
              >
                <ZoomIn size={15} color="#475569" />
              </button>
            </div>

            {/* Extracted Text Toggle */}
            <button
              type="button"
              onClick={() => setShowExtractedText((v) => !v)}
              className="btn btn-outline btn-sm"
              style={{
                fontSize: '0.78rem',
                padding: '5px 10px',
                borderColor: showExtractedText ? '#1769C2' : '#CBD5E1',
                backgroundColor: showExtractedText ? '#EFF6FF' : '#FFFFFF',
                color: showExtractedText ? '#1769C2' : '#475569',
              }}
              title="Inspect extracted text & fields"
            >
              <FileText size={14} />
              <span>{showExtractedText ? 'Hide Text' : 'Extracted Text'}</span>
            </button>
          </div>
        </div>

        {/* Processing State: Replacement & Parsing HUD */}
        {isReplacing && (
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
            }}
          >
            <Loader2 size={22} className="spin-animation" color="#1769C2" />
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#1E3A8A' }}>
                {replaceStep === 'uploading' && 'Uploading replacement PDF resume...'}
                {replaceStep === 'parsing' && 'Extracting candidate skills, experience, and profile structure...'}
                {replaceStep === 'activating' && 'Activating version and synchronizing candidate profile...'}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#2563EB', marginTop: '2px' }}>
                Previous active resume remains safe and operational until synchronization is confirmed.
              </div>
            </div>
          </div>
        )}

        {/* Conflict Confirmation Step Dialog */}
        {replaceStep === 'confirm_diff' && replacementData && (
          <div
            style={{
              padding: '18px 20px',
              backgroundColor: '#FFFBEB',
              border: '1px solid #FCD34D',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={20} color="#D97706" />
              <div>
                <h4 style={{ margin: 0, fontSize: '0.92rem', fontWeight: 700, color: '#92400E' }}>
                  {replacementData.diff.conflicts && replacementData.diff.conflicts.length > 0
                    ? 'Profile Changes Awaiting Confirmation'
                    : 'Confirm Resume Replacement'}
                </h4>
                <div style={{ fontSize: '0.8rem', color: '#B45309', marginTop: '2px' }}>
                  {replacementData.diff.conflicts && replacementData.diff.conflicts.length > 0
                    ? 'The replacement resume contains different information for fields you previously saved. Choose which values to keep:'
                    : `Replacement resume ${replacementData.new_resume.file_name} (v${replacementData.new_resume.version}) uploaded as an inactive draft. Review details below and confirm activation.`}
                </div>
              </div>
            </div>

            {/* List of Conflicting Fields or Empty State */}
            {replacementData.diff.conflicts && replacementData.diff.conflicts.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {replacementData.diff.conflicts.map((c: ConflictField) => {
                  const isSelectedNew = selectedFieldOverrides[c.field] === c.extracted_value;
                  return (
                    <div
                      key={c.field}
                      style={{
                        padding: '12px 14px',
                        backgroundColor: '#FFFFFF',
                        border: '1px solid #E5E7EB',
                        borderRadius: '8px',
                        fontSize: '0.84rem',
                      }}
                    >
                      <div style={{ fontWeight: 700, color: '#1F2937', marginBottom: '6px' }}>
                        {c.label}
                      </div>
                      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: !isSelectedNew ? '2px solid #1769C2' : '1px solid #E5E7EB',
                            backgroundColor: !isSelectedNew ? '#EFF6FF' : '#F9FAFB',
                          }}
                        >
                          <input
                            type="radio"
                            name={`conflict_${c.field}`}
                            checked={!isSelectedNew}
                            onChange={() =>
                              setSelectedFieldOverrides((prev) => ({
                                ...prev,
                                [c.field]: c.current_value,
                              }))
                            }
                          />
                          <span>
                            <strong>Keep Current:</strong> {String(c.current_value || 'Empty')}
                          </span>
                        </label>

                        <label
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: isSelectedNew ? '2px solid #1769C2' : '1px solid #E5E7EB',
                            backgroundColor: isSelectedNew ? '#EFF6FF' : '#F9FAFB',
                          }}
                        >
                          <input
                            type="radio"
                            name={`conflict_${c.field}`}
                            checked={isSelectedNew}
                            onChange={() =>
                              setSelectedFieldOverrides((prev) => ({
                                ...prev,
                                [c.field]: c.extracted_value,
                              }))
                            }
                          />
                          <span>
                            <strong>Apply New Resume:</strong> {String(c.extracted_value || 'Empty')}
                          </span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  padding: '14px 16px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '0.84rem',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                }}
              >
                <Check size={18} color="#16A34A" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 600, color: '#166534', marginBottom: '4px' }}>
                    No Conflicting Field Values
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#4B5563', lineHeight: '1.4' }}>
                    Extracted contact info aligns with your saved profile. Confirming will activate version v{replacementData.new_resume.version}, synchronize newly extracted skills and experiences, and archive your previous active resume.
                  </div>
                </div>
              </div>
            )}

            {/* Preserved manual fields notice */}
            {replacementData.diff.preserved_fields && replacementData.diff.preserved_fields.length > 0 && (
              <div style={{ fontSize: '0.78rem', color: '#6B7280' }}>
                <strong>Preserved manual fields:</strong>{' '}
                {replacementData.diff.preserved_fields.join(', ')} (no evidence in replacement file, keeping saved values).
              </div>
            )}

            {/* Actions for conflict confirmation */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setReplaceStep('idle');
                  setReplacementData(null);
                }}
                className="btn btn-outline btn-sm"
              >
                Cancel Replacement
              </button>
              <button
                type="button"
                onClick={() => handleConfirmActivation()}
                className="btn btn-primary btn-sm"
                style={{ backgroundColor: '#1769C2' }}
              >
                <Check size={14} />
                <span>Confirm &amp; Activate v{replacementData.new_resume.version}</span>
              </button>
            </div>
          </div>
        )}

        {/* Main Document Preview Pane */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '520px',
            backgroundColor: '#334155',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid #CBD5E1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isLoadingPdf ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: '#FFFFFF' }}>
              <Loader2 size={32} className="spin-animation" color="#93C5FD" />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Rendering document preview...</span>
            </div>
          ) : pdfLoadError ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                padding: '24px',
                textAlign: 'center',
                color: '#F8FAFC',
                maxWidth: '420px',
              }}
            >
              <AlertTriangle size={36} color="#FBBF24" />
              <div style={{ fontSize: '1rem', fontWeight: 700 }}>Resume Document Preview Unavailable</div>
              <p style={{ fontSize: '0.84rem', color: '#CBD5E1', margin: 0, lineHeight: 1.5 }}>
                {pdfLoadError}
              </p>
              <button
                type="button"
                onClick={handleTriggerFilePicker}
                className="btn btn-primary btn-sm"
                style={{ marginTop: '8px', backgroundColor: '#1769C2' }}
              >
                <Upload size={14} />
                <span>Upload Working Replacement</span>
              </button>
            </div>
          ) : blobUrl ? (
            <div
              style={{
                width: '100%',
                height: '100%',
                overflow: 'auto',
                display: 'flex',
                justifyContent: 'center',
                backgroundColor: '#475569',
              }}
            >
              <div
                style={{
                  width: `${zoomLevel}%`,
                  height: '100%',
                  transition: 'width 150ms ease-out',
                }}
              >
                <iframe
                  src={`${blobUrl}#zoom=${zoomLevel}&page=${currentPage}`}
                  title={displayFileName}
                  width="100%"
                  height="100%"
                  style={{ border: 'none', display: 'block', backgroundColor: '#FFFFFF' }}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Collapsible Extracted Text & Structured Fields Drawer */}
        {showExtractedText && currentResume && (
          <div
            style={{
              padding: '16px',
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.86rem', color: '#1E293B', textTransform: 'uppercase' }}>
                Extracted Text &amp; Structured Fields
              </div>
              <button
                type="button"
                onClick={() => setShowExtractedText(false)}
                className="btn-icon"
                title="Close text inspector"
              >
                <X size={15} />
              </button>
            </div>

            {currentResume.parsed_data && Object.keys(currentResume.parsed_data).length > 0 && (
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                  Parsed JSON Structure
                </div>
                <pre
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: '0.78rem',
                    maxHeight: '140px',
                    overflowY: 'auto',
                    margin: 0,
                  }}
                >
                  {JSON.stringify(currentResume.parsed_data, null, 2)}
                </pre>
              </div>
            )}

            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                Raw Extracted Text
              </div>
              <pre
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  fontSize: '0.78rem',
                  maxHeight: '160px',
                  overflowY: 'auto',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.45,
                }}
              >
                {currentResume.parsed_text || 'No text extracted from this document.'}
              </pre>
            </div>
          </div>
        )}

        {/* Modal Footer: Primary Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: '12px',
            borderTop: '1px solid #E2E8F0',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          {/* Action 1: Back (closes preview without altering active resume) */}
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.86rem',
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={15} />
            <span>Back to Resumes</span>
          </button>

          {/* Action 2: Replace Resume & Optional Download */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {blobUrl && (
              <a
                href={blobUrl}
                download={displayFileName}
                className="btn btn-outline"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.86rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
              >
                <Download size={14} />
                <span>Download PDF</span>
              </a>
            )}

            <button
              type="button"
              onClick={handleTriggerFilePicker}
              disabled={isReplacing || isDuplicateSubmitting}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.86rem',
                fontWeight: 600,
                backgroundColor: '#1769C2',
                borderColor: '#1769C2',
              }}
            >
              {isReplacing ? (
                <>
                  <Loader2 size={15} className="spin-animation" />
                  <span>Processing Replacement...</span>
                </>
              ) : (
                <>
                  <Upload size={15} />
                  <span>Replace Resume</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
