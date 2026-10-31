"""Deterministic ATS (Applicant Tracking System) Resume Analyzer."""

from __future__ import annotations

import io
import re
from typing import Any, Dict, List, Optional
import pdfplumber

ACTION_VERBS = [
    "accelerated", "accomplished", "achieved", "analyzed", "architected", "automated",
    "built", "collaborated", "constructed", "created", "decreased", "delivered",
    "deployed", "designed", "developed", "directed", "engineered", "enhanced",
    "established", "executed", "expanded", "generated", "implemented", "improved",
    "increased", "initiated", "launched", "led", "managed", "maximized", "mentored",
    "minimized", "modernized", "negotiated", "optimized", "orchestrated", "organized",
    "overhauled", "pioneered", "produced", "reduced", "refactored", "resolved",
    "restructured", "revamped", "scaled", "simplified", "spearheaded", "standardized",
    "streamlined", "supervised", "tested", "transformed", "upgraded"
]

TECH_KEYWORDS = [
    "python", "javascript", "typescript", "react", "next.js", "node.js", "vue",
    "angular", "fastapi", "django", "flask", "sql", "postgresql", "mysql", "mongodb",
    "redis", "docker", "kubernetes", "aws", "gcp", "azure", "linux", "git", "ci/cd",
    "playwright", "selenium", "pytest", "jest", "cypress", "rest api", "graphql",
    "microservices", "kafka", "rabbitmq", "html", "css", "tailwind", "java", "c++",
    "c#", "go", "rust", "agile", "scrum", "jira", "unit testing", "devops"
]


class ATSResumeAnalyzer:
    @classmethod
    def analyze_pdf(cls, file_bytes: bytes, filename: str = "resume.pdf") -> Dict[str, Any]:
        """Perform comprehensive, evidence-based ATS analysis on PDF bytes."""
        findings: List[Dict[str, Any]] = []
        pages_text: List[str] = []
        total_tables = 0
        page_count = 0

        # 1. PDF Extraction
        try:
            with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
                page_count = len(pdf.pages)
                for page_idx, page in enumerate(pdf.pages):
                    text = page.extract_text() or ""
                    pages_text.append(text)
                    try:
                        tables = page.extract_tables()
                        if tables:
                            total_tables += len(tables)
                    except Exception:
                        pass
        except Exception as exc:
            return {
                "overall_score": 15,
                "grade": "D (Unreadable)",
                "summary": "The file could not be parsed as a standard PDF. It may be corrupt or encrypted.",
                "subscores": {
                    "extractability": 0,
                    "sections": 0,
                    "content": 10,
                    "impact": 5,
                },
                "metrics": {
                    "page_count": 0,
                    "word_count": 0,
                    "tables_detected": 0,
                },
                "findings": [
                    {
                        "id": "pdf-corrupt",
                        "severity": "high",
                        "category": "extractability",
                        "title": "Corrupt or Unreadable PDF",
                        "evidence": str(exc)[:100],
                        "why_it_matters": "Most ATS platforms reject files that cannot be decoded cleanly into text.",
                        "recommendation": "Re-export your resume from Google Docs or Word directly as a clean PDF.",
                    }
                ],
                "extracted_text_preview": "",
            }

        full_text = "\n\n".join(pages_text).strip()
        words = re.findall(r"\b[A-Za-z0-9+#.-]+\b", full_text)
        word_count = len(words)

        # Scanned / Image-only PDF check
        if word_count < 25:
            return {
                "overall_score": 20,
                "grade": "D (Scanned / Image Only)",
                "summary": "Almost no machine-readable text was detected. The PDF appears to be a scanned image or flattened graphic.",
                "subscores": {
                    "extractability": 5,
                    "sections": 5,
                    "content": 5,
                    "impact": 5,
                },
                "metrics": {
                    "page_count": page_count,
                    "word_count": word_count,
                    "tables_detected": total_tables,
                },
                "findings": [
                    {
                        "id": "scanned-pdf",
                        "severity": "high",
                        "category": "extractability",
                        "title": "Text is Not Machine-Readable",
                        "evidence": f"Only {word_count} words extracted across {page_count} page(s).",
                        "why_it_matters": "ATS parsers (Workday, Greenhouse, Lever) cannot read graphic text without OCR, causing immediate disqualification.",
                        "recommendation": "Do not scan or photograph your resume. Export directly to PDF from Word, Google Docs, or Canva using selectable text.",
                    }
                ],
                "extracted_text_preview": full_text[:500],
            }

        # Subscore trackers (max 25 each, total 100)
        extractability_score = 25
        sections_score = 25
        content_score = 25
        impact_score = 25

        # Check 1: Multi-page length
        if page_count > 2:
            extractability_score -= 5
            findings.append({
                "id": "length-warning",
                "severity": "medium",
                "category": "formatting",
                "title": f"Resume is {page_count} Pages Long",
                "evidence": f"Total pages: {page_count}",
                "why_it_matters": "Resumes over 2 pages often suffer from candidate fatigue and parsing drop-off.",
                "recommendation": "Condense your resume to 1-2 pages focusing on your most relevant achievements.",
            })

        # Check 2: Table layout risk
        if total_tables > 1:
            extractability_score -= 5
            findings.append({
                "id": "table-risk",
                "severity": "medium",
                "category": "formatting",
                "title": "Complex Tables Detected",
                "evidence": f"Found {total_tables} table structures in the PDF.",
                "why_it_matters": "Older ATS parsers read across table columns horizontally, jumbling job titles and dates.",
                "recommendation": "Use clean single-column or linear formatting with standard bullet points instead of HTML/Word tables.",
            })

        # Check 3: Contact information detection
        email_match = re.search(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+", full_text)
        phone_match = re.search(r"(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", full_text)
        linkedin_match = re.search(r"linkedin\.com/in/[a-zA-Z0-9_-]+", full_text, re.IGNORECASE)

        if not email_match:
            sections_score -= 8
            findings.append({
                "id": "missing-email",
                "severity": "high",
                "category": "contact",
                "title": "Email Address Not Detected",
                "evidence": "No valid email pattern found in extracted text.",
                "why_it_matters": "Recruiters and automated systems cannot contact you without a clear email.",
                "recommendation": "Place a standard email address (e.g. name@domain.com) clearly in your header.",
            })

        if not phone_match:
            sections_score -= 5
            findings.append({
                "id": "missing-phone",
                "severity": "medium",
                "category": "contact",
                "title": "Phone Number Missing or Unrecognized",
                "evidence": "No standard phone format recognized.",
                "why_it_matters": "Many screening systems require a contact phone number to proceed with interview scheduling.",
                "recommendation": "Add your phone number with your country code in the top header.",
            })

        if not linkedin_match:
            findings.append({
                "id": "missing-linkedin",
                "severity": "low",
                "category": "contact",
                "title": "LinkedIn Profile URL Not Found",
                "evidence": "No 'linkedin.com/in/...' link detected.",
                "why_it_matters": "Over 87% of technical recruiters review the candidate's LinkedIn profile during screening.",
                "recommendation": "Include your customized LinkedIn URL in the header section.",
            })

        # Check 4: Section Headings
        lower_text = full_text.lower()
        has_experience = any(re.search(rf"\b{term}\b", lower_text) for term in ["experience", "work history", "employment", "professional background"])
        has_education = any(re.search(rf"\b{term}\b", lower_text) for term in ["education", "academic", "degree", "university", "college"])
        has_skills = any(re.search(rf"\b{term}\b", lower_text) for term in ["skills", "technical skills", "technologies", "competencies"])

        if not has_experience:
            sections_score -= 8
            findings.append({
                "id": "missing-experience-header",
                "severity": "high",
                "category": "sections",
                "title": "Standard 'Experience' Header Missing",
                "evidence": "Could not identify a standard Experience or Work History section.",
                "why_it_matters": "ATS systems categorize job titles and employment durations under standardized section headers.",
                "recommendation": "Label your professional history section clearly as 'Experience' or 'Work Experience'.",
            })

        if not has_education:
            sections_score -= 4
            findings.append({
                "id": "missing-education-header",
                "severity": "medium",
                "category": "sections",
                "title": "Standard 'Education' Header Missing",
                "evidence": "No clear Education section header found.",
                "why_it_matters": "Automated filters check for degree requirements (e.g., Bachelor's, Master's) under an Education heading.",
                "recommendation": "Add a prominent 'Education' section with your degree, institution, and graduation year.",
            })

        if not has_skills:
            sections_score -= 4
            findings.append({
                "id": "missing-skills-header",
                "severity": "medium",
                "category": "sections",
                "title": "'Skills' Section Header Missing",
                "evidence": "No designated Skills or Technologies heading identified.",
                "why_it_matters": "Keyword scanners specifically parse the Skills block to calculate job qualification match percentages.",
                "recommendation": "Create a dedicated 'Skills' section listing your technical proficiencies.",
            })

        # Check 5: Keywords & Skills Density
        found_keywords = [kw for kw in TECH_KEYWORDS if kw in lower_text]
        if len(found_keywords) < 4:
            content_score -= 10
            findings.append({
                "id": "low-keyword-density",
                "severity": "high",
                "category": "content",
                "title": "Low Technical Keyword Density",
                "evidence": f"Only detected {len(found_keywords)} recognized technical skills ({', '.join(found_keywords) if found_keywords else 'none'}).",
                "why_it_matters": "ATS algorithms rank resumes by keyword overlap with the job description.",
                "recommendation": "Explicitly mention relevant tools, frameworks, and programming languages you have used.",
            })
        elif len(found_keywords) < 8:
            content_score -= 4
            findings.append({
                "id": "moderate-keywords",
                "severity": "low",
                "category": "content",
                "title": "Moderate Skill Keyword Coverage",
                "evidence": f"Detected {len(found_keywords)} skills: {', '.join(found_keywords[:6])}...",
                "why_it_matters": "Adding additional industry-standard tooling can increase search discoverability.",
                "recommendation": "Tailor your skills list to match the exact terms used in your target job descriptions.",
            })

        # Check 6: Action Verbs & Impact
        found_verbs = [v for v in ACTION_VERBS if re.search(rf"\b{v}\b", lower_text)]
        if len(found_verbs) < 5:
            impact_score -= 8
            findings.append({
                "id": "weak-action-verbs",
                "severity": "medium",
                "category": "impact",
                "title": "Few Strong Action Verbs",
                "evidence": f"Detected {len(found_verbs)} leadership/action verbs.",
                "why_it_matters": "Bullets starting with passive phrasing (e.g. 'Responsible for', 'Assisted with') score lower with hiring managers.",
                "recommendation": "Start every bullet point with a decisive past-tense action verb like 'Architected', 'Spearheaded', 'Optimized', or 'Automated'.",
            })

        # Check 7: Quantifiable Metrics & Numbers
        metric_matches = re.findall(r"(\b\d+%\b|\$\d+[\d,]*|\b\d+\s*(?:users|clients|ms|seconds|hours|x|fold|million|k)\b)", lower_text)
        if len(metric_matches) < 2:
            impact_score -= 9
            findings.append({
                "id": "missing-metrics",
                "severity": "high",
                "category": "impact",
                "title": "Lack of Quantifiable Achievements",
                "evidence": f"Only {len(metric_matches)} measurable metrics found ({', '.join(metric_matches) if metric_matches else 'none'}).",
                "why_it_matters": "Top-tier resumes demonstrate impact through numbers (e.g. 'Reduced load times by 35%', 'Scaled API to 100K daily active users').",
                "recommendation": "Add quantifiable results with percentages, dollar amounts, time saved, or user scale to your experience bullets.",
            })

        # Ensure positive scores
        extractability_score = max(5, min(25, extractability_score))
        sections_score = max(5, min(25, sections_score))
        content_score = max(5, min(25, content_score))
        impact_score = max(5, min(25, impact_score))

        total_score = extractability_score + sections_score + content_score + impact_score

        if total_score >= 88:
            grade = "A (ATS Ready)"
            summary = "Excellent resume! Highly readable by modern applicant tracking systems with strong keyword presence."
        elif total_score >= 74:
            grade = "B (Good with Minor Fixes)"
            summary = "Solid resume foundation. Addressing a few missing metrics or keywords will improve pass-through rates."
        elif total_score >= 58:
            grade = "C (Needs Optimization)"
            summary = "Several formatting or keyword gaps were detected that could cause your resume to be filtered out."
        else:
            grade = "D (High Risk of ATS Rejection)"
            summary = "Significant parsing risks detected. Follow the recommendations below to restructure your resume."

        return {
            "overall_score": total_score,
            "grade": grade,
            "summary": summary,
            "subscores": {
                "extractability": extractability_score,
                "sections": sections_score,
                "content": content_score,
                "impact": impact_score,
            },
            "metrics": {
                "page_count": page_count,
                "word_count": word_count,
                "tables_detected": total_tables,
                "keywords_detected": len(found_keywords),
                "action_verbs_detected": len(found_verbs),
            },
            "findings": findings,
            "extracted_text_preview": full_text[:800],
        }
