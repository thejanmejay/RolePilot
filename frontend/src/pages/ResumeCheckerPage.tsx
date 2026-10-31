import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  ArrowRight,
  Download,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Award,
} from 'lucide-react';
import { useNavigate } from '../context/NavigationContext';
import { RolePilotLogo } from '../components/common/RolePilotLogo';
import { PublicFooter } from '../components/common/PublicFooter';
import type { ATSAnalysisResult } from '../api/ats';
import { checkResumeATS } from '../api/ats';

export const ResumeCheckerPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dragActive, setDragActive] = useState<boolean>(false);
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisStep, setAnalysisStep] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ATSAnalysisResult | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  const handleFileSelected = (selectedFile: File) => {
    setError(null);
    if (!selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF resumes (.pdf) are supported for ATS compatibility analysis.');
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      setError('File size exceeds the 5MB limit. Please upload a smaller PDF resume.');
      return;
    }
    setFile(selectedFile);
    processFile(selectedFile);
  };

  const processFile = async (targetFile: File) => {
    setIsAnalyzing(true);
    setError(null);

    setAnalysisStep('Reading PDF text layers and font encodings...');
    await new Promise((r) => setTimeout(r, 400));

    setAnalysisStep('Auditing contact details and essential section headers...');
    await new Promise((r) => setTimeout(r, 450));

    setAnalysisStep('Evaluating technical keywords, action verbs, and quantifiable metrics...');

    try {
      const data = await checkResumeATS(targetFile);
      setResult(data);
    } catch (err: any) {
      console.error('ATS check failed', err);
      const msg = err.response?.data?.detail || err.message || 'Failed to analyze resume. Please try again.';
      setError(msg);
    } finally {
      setIsAnalyzing(false);
      setAnalysisStep('');
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const filteredFindings = result
    ? selectedSeverity === 'all'
      ? result.findings
      : result.findings.filter((f) => f.severity === selectedSeverity)
    : [];

  const getScoreColor = (score: number) => {
    if (score >= 88) return '#16A34A';
    if (score >= 74) return '#1769C2';
    if (score >= 58) return '#D97706';
    return '#DC2626';
  };

  return (
    <div className="ats-checker-page-container" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
      {/* Public Header */}
      <header style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border)', padding: '14px 24px' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }} onClick={() => navigate('/')}>
            <RolePilotLogo variant="compact" height={34} alt="RolePilot" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 8px', borderRadius: '4px' }}>
              Free ATS Checker
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => navigate('/login')}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', padding: '8px 12px' }}
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/signup')}
              style={{ background: 'var(--primary)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}
            >
              Start Free
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: '1000px', width: '100%', margin: '0 auto', padding: '32px 20px' }}>
        {/* Hero Title */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <h1 style={{ fontSize: '2.1rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '10px' }}>
            Free ATS Resume Checker & Score
          </h1>
          <p style={{ fontSize: '1.05rem', color: 'var(--text-muted)', maxWidth: '640px', margin: '0 auto' }}>
            Test your resume against modern Applicant Tracking System algorithms. Get deterministic subscores, keyword density analysis, and concrete fixes — 100% free with no signup required.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#B91C1C' }}>
            <AlertCircle size={20} />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>{error}</span>
          </div>
        )}

        {/* Upload State */}
        {!result && !isAnalyzing && (
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: dragActive ? 'var(--primary-light)' : '#FFFFFF',
              border: `2px dashed ${dragActive ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: '16px',
              padding: '48px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--primary-light)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <UploadCloud size={32} />
            </div>

            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
              Upload your PDF resume to scan
            </h3>
            <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Drag and drop your file here, or click to browse (PDF only, up to 5MB)
            </p>

            <button
              type="button"
              style={{
                background: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 24px',
                fontSize: '0.92rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Choose PDF Resume
            </button>

            <div style={{ marginTop: '28px', display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} color="var(--success)" /> 100% Private & In-Memory
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="var(--primary)" /> Real-Time Heuristics
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Award size={16} color="var(--warning)" /> Zero Paywall
              </span>
            </div>
          </div>
        )}

        {/* Loading / Analyzing State */}
        {isAnalyzing && (
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '48px 24px', textAlign: 'center', border: '1px solid var(--border)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
            <div className="notification-spinner" style={{ width: '40px', height: '40px', borderWidth: '3px', margin: '0 auto 20px' }} />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px' }}>
              Analyzing {file?.name}...
            </h3>
            <p style={{ fontSize: '0.95rem', color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto' }}>
              {analysisStep}
            </p>
          </div>
        )}

        {/* Results Report View */}
        {result && (
          <div className="ats-report-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Top Score Banner */}
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--border)', padding: '28px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '24px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                {/* Circular Score Badge */}
                <div style={{
                  width: '90px',
                  height: '90px',
                  borderRadius: '50%',
                  border: `6px solid ${getScoreColor(result.overall_score)}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#F8FAFC',
                }}>
                  <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1 }}>
                    {result.overall_score}
                  </span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    / 100
                  </span>
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                    <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      Overall ATS Score
                    </h2>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: '9999px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      backgroundColor: `${getScoreColor(result.overall_score)}1A`,
                      color: getScoreColor(result.overall_score),
                    }}>
                      {result.grade}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.92rem', color: 'var(--text-muted)', margin: 0, maxWidth: '520px' }}>
                    {result.summary}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => window.print()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: '#FFFFFF',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Download size={15} /> Print Report
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: '#FFFFFF',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <RotateCcw size={15} /> Scan Another
                </button>
              </div>
            </div>

            {/* Subscores Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
              <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--border)', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Extractability</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{result.subscores.extractability}/25</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${(result.subscores.extractability / 25) * 100}%`, height: '100%', background: 'var(--primary)' }} />
                </div>
              </div>

              <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--border)', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Section Structure</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{result.subscores.sections}/25</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${(result.subscores.sections / 25) * 100}%`, height: '100%', background: 'var(--success)' }} />
                </div>
              </div>

              <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--border)', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Content & Skills</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{result.subscores.content}/25</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${(result.subscores.content / 25) * 100}%`, height: '100%', background: '#8B5CF6' }} />
                </div>
              </div>

              <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--border)', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Action & Metrics</span>
                  <span style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>{result.subscores.impact}/25</span>
                </div>
                <div style={{ width: '100%', height: '6px', background: '#F1F5F9', borderRadius: '9999px', overflow: 'hidden' }}>
                  <div style={{ width: `${(result.subscores.impact / 25) * 100}%`, height: '100%', background: '#F59E0B' }} />
                </div>
              </div>
            </div>

            {/* Quick Metrics Strip */}
            <div style={{ background: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--border)', padding: '14px 20px', display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span><strong>Pages:</strong> {result.metrics.page_count}</span>
              <span><strong>Words:</strong> {result.metrics.word_count}</span>
              <span><strong>Tables Detected:</strong> {result.metrics.tables_detected}</span>
              {result.metrics.keywords_detected !== undefined && (
                <span><strong>Skills Found:</strong> {result.metrics.keywords_detected}</span>
              )}
              {result.metrics.action_verbs_detected !== undefined && (
                <span><strong>Action Verbs:</strong> {result.metrics.action_verbs_detected}</span>
              )}
            </div>

            {/* Findings & Actionable Recommendations */}
            <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid var(--border)', padding: '24px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 4px' }}>
                    Actionable Improvements ({result.findings.length})
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                    Prioritized recommendations to maximize ATS pass-through and recruiter readability.
                  </p>
                  <p style={{ fontSize: '0.78rem', color: '#64748B', margin: '6px 0 0', fontStyle: 'italic' }}>
                    Note: This score is based on automated heuristics and common ATS parsing standards. Individual employer configurations (Workday, Greenhouse, Lever, etc.) vary, and results do not guarantee job selection or universal ATS compatibility.
                  </p>
                </div>

                {/* Severity Filter Pills */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['all', 'high', 'medium', 'low'] as const).map((sev) => {
                    const count = sev === 'all' ? result.findings.length : result.findings.filter((f) => f.severity === sev).length;
                    return (
                      <button
                        key={sev}
                        type="button"
                        onClick={() => setSelectedSeverity(sev)}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '9999px',
                          border: `1px solid ${selectedSeverity === sev ? 'var(--primary)' : 'var(--border)'}`,
                          background: selectedSeverity === sev ? 'var(--primary-light)' : '#FFFFFF',
                          color: selectedSeverity === sev ? 'var(--primary)' : 'var(--text-muted)',
                          fontSize: '0.78rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          textTransform: 'capitalize',
                        }}
                      >
                        {sev} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Findings List */}
              {filteredFindings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)' }}>
                  <CheckCircle2 size={32} color="var(--success)" style={{ margin: '0 auto 8px' }} />
                  <p style={{ fontWeight: 600, margin: 0 }}>No issues found in this category!</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {filteredFindings.map((finding) => {
                    const isHigh = finding.severity === 'high';
                    const isMed = finding.severity === 'medium';
                    return (
                      <div
                        key={finding.id}
                        style={{
                          border: '1px solid var(--border)',
                          borderRadius: '10px',
                          padding: '16px',
                          background: isHigh ? '#FFFBFB' : isMed ? '#FFFDF8' : '#F8FAFC',
                          borderLeft: `4px solid ${isHigh ? '#DC2626' : isMed ? '#D97706' : '#1769C2'}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {isHigh ? <AlertCircle size={18} color="#DC2626" /> : isMed ? <AlertTriangle size={18} color="#D97706" /> : <Info size={18} color="#1769C2" />}
                            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                              {finding.title}
                            </h4>
                          </div>
                          <span style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: isHigh ? '#FEE2E2' : isMed ? '#FEF3C7' : '#DBEAFE',
                            color: isHigh ? '#991B1B' : isMed ? '#92400E' : '#1E40AF',
                          }}>
                            {finding.severity}
                          </span>
                        </div>

                        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                          <strong>Why it matters:</strong> {finding.why_it_matters}
                        </p>

                        <div style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px', fontSize: '0.82rem' }}>
                          <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Recommended Fix: </span>
                          <span style={{ color: 'var(--text-main)' }}>{finding.recommendation}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Next Step CTA */}
            <div style={{ background: 'linear-gradient(135deg, #1769C2 0%, #111827 100%)', borderRadius: '16px', padding: '32px 28px', color: '#ffffff', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 800, margin: '0 0 8px' }}>
                  Ready to Automate Your Job Search?
                </h3>
                <p style={{ fontSize: '0.92rem', opacity: 0.9, margin: 0, maxWidth: '520px' }}>
                  RolePilot matches you with verified jobs, auto-customizes questions, and runs safe 1-click dry runs before live submissions.
                </p>
              </div>
              <button
                onClick={() => navigate('/signup')}
                style={{
                  background: '#ffffff',
                  color: 'var(--primary)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px 24px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                Start Applying Free <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Public Footer */}
      <PublicFooter />
    </div>
  );
};
