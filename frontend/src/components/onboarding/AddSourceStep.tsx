import React, { useState, useRef } from 'react';
import {
  FileText,
  Upload,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Trash2,
  Info,
} from 'lucide-react';
import { Badge } from '../common/Badge';

export interface AddSourceStepProps {
  initialResumeFile: File | null;
  initialPortfolioUrl: string;
  onContinue: (source: { resumeFile: File | null; portfolioUrl: string }) => void;
  isSubmitting?: boolean;
}

export const AddSourceStep: React.FC<AddSourceStepProps> = ({
  initialResumeFile,
  initialPortfolioUrl,
  onContinue,
  isSubmitting = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeSourceType, setActiveSourceType] = useState<'resume' | 'portfolio'>(() => {
    if (initialResumeFile) return 'resume';
    if (initialPortfolioUrl.trim()) return 'portfolio';
    return 'resume';
  });

  const [selectedResumeFile, setSelectedResumeFile] = useState<File | null>(
    activeSourceType === 'resume' ? initialResumeFile : null
  );
  const [portfolioUrl, setPortfolioUrl] = useState<string>(
    activeSourceType === 'portfolio' ? initialPortfolioUrl : ''
  );

  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const validateFile = (file: File): string | null => {
    const isPdf =
      file.name.toLowerCase().endsWith('.pdf') ||
      file.type === 'application/pdf';
    if (!isPdf) {
      return 'Please upload a PDF file for your resume.';
    }
    if (file.size > 10 * 1024 * 1024) {
      return 'File size exceeds the 10 MB maximum limit.';
    }
    return null;
  };

  const handleSelectResumeMode = () => {
    setActiveSourceType('resume');
    setPortfolioUrl('');
    setValidationError(null);
  };

  const handleSelectPortfolioMode = () => {
    setActiveSourceType('portfolio');
    setSelectedResumeFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setValidationError(null);
  };

  const handleFileSelect = (file: File) => {
    const err = validateFile(file);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setSelectedResumeFile(file);
    setActiveSourceType('resume');
    setPortfolioUrl('');
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedResumeFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handlePortfolioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPortfolioUrl(val);
    setActiveSourceType('portfolio');
    setSelectedResumeFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (validationError) setValidationError(null);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const hasResume = Boolean(selectedResumeFile);
    const hasPortfolio = Boolean(portfolioUrl.trim());

    if (!hasResume && !hasPortfolio) {
      setValidationError('Please upload a resume or provide a portfolio URL to continue.');
      return;
    }

    if (activeSourceType === 'resume') {
      if (!selectedResumeFile) {
        setValidationError('Please upload a PDF resume file to continue.');
        return;
      }
      onContinue({
        resumeFile: selectedResumeFile,
        portfolioUrl: '',
      });
      return;
    }

    // Public URL mode
    if (!portfolioUrl.trim()) {
      setValidationError('Please enter a public portfolio, LinkedIn, or website URL.');
      return;
    }

    try {
      let urlToCheck = portfolioUrl.trim();
      if (!urlToCheck.startsWith('http://') && !urlToCheck.startsWith('https://')) {
        urlToCheck = `https://${urlToCheck}`;
      }
      const parsed = new URL(urlToCheck);
      if (!parsed.hostname || !parsed.hostname.includes('.')) {
        setValidationError('Please enter a valid website, LinkedIn, or GitHub URL.');
        return;
      }
      if (parsed.hostname.includes('linkedin.com')) {
        setValidationError(
          'LinkedIn URLs cannot be extracted via public web crawling. Please export your LinkedIn profile as a PDF ("More" → "Save to PDF") and upload it under Resume, or use a personal portfolio or GitHub URL.'
        );
        return;
      }
    } catch {
      setValidationError('Please enter a valid website, LinkedIn, or GitHub URL.');
      return;
    }

    onContinue({
      resumeFile: null,
      portfolioUrl: portfolioUrl.trim(),
    });
  };

  const isResumeSelected = activeSourceType === 'resume';
  const isPortfolioSelected = activeSourceType === 'portfolio';

  return (
    <form onSubmit={handleFormSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
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
          Create Your Profile
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
          Upload your resume or provide a portfolio URL to get started. We'll extract your information automatically.
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

      {/* 2 Selectable Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
        }}
      >
        {/* CARD 1: Upload Resume */}
        <div
          onClick={() => {
            handleSelectResumeMode();
            if (!selectedResumeFile) fileInputRef.current?.click();
          }}
          style={{
            position: 'relative',
            backgroundColor: '#FFFFFF',
            border: isResumeSelected ? '2px solid #1769E8' : '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '24px 20px',
            boxShadow: isResumeSelected ? '0 4px 16px rgba(23, 105, 232, 0.08)' : '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
            opacity: isResumeSelected ? 1 : 0.75,
          }}
        >
          {/* Card Top Row: Icon + Recommended Badge + Selection Check */}
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: isResumeSelected ? '#EFF6FF' : '#F1F5F9',
                    color: isResumeSelected ? '#1769E8' : '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={20} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontWeight: 700, fontSize: '1.02rem', color: '#101A3A' }}>
                      Upload Resume
                    </span>
                    <Badge variant="primary" size="sm">
                      Recommended
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Selection Indicator */}
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: isResumeSelected ? 'none' : '2px solid #CBD5E1',
                  backgroundColor: isResumeSelected ? '#1769E8' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                }}
              >
                {isResumeSelected && <CheckCircle2 size={16} />}
              </div>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.45, margin: '0 0 16px 0' }}>
              Upload your resume (PDF) and we'll automatically extract your information.
            </p>

            {/* Inner Dropzone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              style={{
                border: isDragging ? '2px dashed #1769E8' : '1px dashed #CBD5E1',
                borderRadius: '10px',
                padding: '24px 16px',
                textAlign: 'center',
                backgroundColor: isDragging ? '#EFF6FF' : selectedResumeFile ? '#F8FAFC' : '#F8FAFC',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileInputChange}
                style={{ display: 'none' }}
              />

              {selectedResumeFile ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '50%',
                      backgroundColor: '#DCFCE7',
                      color: '#16A34A',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircle2 size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.92rem', fontWeight: 700, color: '#101A3A', wordBreak: 'break-word' }}>
                      {selectedResumeFile.name}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748B', marginTop: '2px' }}>
                      {(selectedResumeFile.size / 1024).toFixed(0)} KB &bull; PDF document ready
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#1769E8',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Replace File
                    </button>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#DC2626',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      <Trash2 size={12} />
                      <span>Remove</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                  <Upload size={24} color="#1769E8" style={{ marginBottom: '4px' }} />
                  <span style={{ fontSize: '0.86rem', fontWeight: 600, color: '#101A3A' }}>
                    Drag and drop your resume here
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#94A3B8' }}>or</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectResumeMode();
                      fileInputRef.current?.click();
                    }}
                    className="btn btn-outline"
                    style={{
                      fontSize: '0.82rem',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      borderColor: '#CBD5E1',
                      color: '#1769E8',
                      fontWeight: 600,
                      marginTop: '4px',
                    }}
                  >
                    Choose File
                  </button>
                  <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '6px' }}>
                    Supports PDF files up to 10 MB
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CARD 2: Use Portfolio URL */}
        <div
          onClick={() => {
            handleSelectPortfolioMode();
            const input = document.getElementById('portfolio-url-input');
            input?.focus();
          }}
          style={{
            position: 'relative',
            backgroundColor: '#FFFFFF',
            border: isPortfolioSelected ? '2px solid #1769E8' : '1px solid #E2E8F0',
            borderRadius: '14px',
            padding: '24px 20px',
            boxShadow: isPortfolioSelected ? '0 4px 16px rgba(23, 105, 232, 0.08)' : '0 2px 8px rgba(0,0,0,0.03)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
            opacity: isPortfolioSelected ? 1 : 0.75,
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '10px',
                    backgroundColor: isPortfolioSelected ? '#EFF6FF' : '#F1F5F9',
                    color: isPortfolioSelected ? '#1769E8' : '#64748B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LinkIcon size={20} />
                </div>
                <div>
                  <span style={{ fontWeight: 700, fontSize: '1.02rem', color: '#101A3A' }}>
                    Use Portfolio URL
                  </span>
                </div>
              </div>

              {/* Selection Indicator */}
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  border: isPortfolioSelected ? 'none' : '2px solid #CBD5E1',
                  backgroundColor: isPortfolioSelected ? '#1769E8' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#FFFFFF',
                }}
              >
                {isPortfolioSelected && <CheckCircle2 size={16} />}
              </div>
            </div>

            <p style={{ fontSize: '0.84rem', color: '#64748B', lineHeight: 1.45, margin: '0 0 16px 0' }}>
              Provide your personal portfolio website or GitHub profile URL and we'll extract your qualifications.
            </p>

            {/* URL Input */}
            <div style={{ marginTop: '12px' }}>
              <label
                htmlFor="portfolio-url-input"
                style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}
              >
                Portfolio or GitHub URL
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="portfolio-url-input"
                  type="url"
                  placeholder="https://yourname.github.io or https://github.com/username"
                  value={portfolioUrl}
                  onChange={handlePortfolioChange}
                  onFocus={handleSelectPortfolioMode}
                  className="input"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    fontSize: '0.86rem',
                    borderRadius: '8px',
                    borderColor: isPortfolioSelected ? '#1769E8' : '#CBD5E1',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              <span style={{ fontSize: '0.75rem', color: '#94A3B8', marginTop: '6px', display: 'block' }}>
                Supports personal portfolio sites, GitHub Pages, or GitHub profile URLs.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '14px 18px',
          backgroundColor: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: '10px',
          color: '#1E40AF',
          fontSize: '0.84rem',
        }}
      >
        <Info size={18} color="#1769E8" style={{ flexShrink: 0 }} />
        <span>Select one option to extract your profile: upload your PDF resume or provide a public URL. At least one source is required to continue.</span>
      </div>

      {/* Bottom Action Area */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
        <button
          type="submit"
          disabled={isSubmitting || (activeSourceType === 'resume' ? !selectedResumeFile : !portfolioUrl.trim())}
          className="btn btn-primary"
          style={{
            height: '46px',
            padding: '0 28px',
            fontSize: '0.94rem',
            fontWeight: 700,
            borderRadius: '10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#1769E8',
            color: '#FFFFFF',
            cursor:
              isSubmitting || (activeSourceType === 'resume' ? !selectedResumeFile : !portfolioUrl.trim())
                ? 'not-allowed'
                : 'pointer',
            opacity:
              isSubmitting || (activeSourceType === 'resume' ? !selectedResumeFile : !portfolioUrl.trim()) ? 0.6 : 1,
          }}
        >
          {isSubmitting ? (
            <span>Starting extraction...</span>
          ) : (
            <>
              <span>{activeSourceType === 'resume' ? 'Extract from Resume' : 'Extract from URL'}</span>
              <ArrowRight size={18} />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
