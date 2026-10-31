"""Service for parsing PDF resumes into structured candidate profile data."""

from __future__ import annotations

import io
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
import pdfplumber

TECH_SKILLS_DICTIONARY = [
    # Programming & Languages
    "Python", "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Vue.js", "Angular",
    "FastAPI", "Django", "Flask", "SQL", "PostgreSQL", "MySQL", "MongoDB", "Redis",
    "Docker", "Kubernetes", "AWS", "GCP", "Azure", "Linux", "Git", "CI/CD",
    "Java", "C++", "C#", "Go", "Rust", "Swift", "Kotlin", "HTML", "CSS", "Tailwind CSS",
    # Testing, QA & Automation
    "Selenium", "Selenium WebDriver", "TestNG", "Playwright", "Cypress", "Pytest", "Jest",
    "Postman", "REST API", "JSON", "Jira", "Zoho Sprints", "Maven", "XPath", "CSS Selectors",
    "Page Object Model", "POM", "Data-Driven Framework", "Explicit Waits",
    "Manual Testing", "Automation Testing", "Functional Testing", "Regression Testing",
    "Smoke Testing", "API Testing", "End-to-End Testing", "Cross-Platform Testing",
    "Agile Scrum", "Agile", "Scrum", "STLC", "SDLC", "JMeter", "Appium", "Cucumber", "BDD", "TDD",
    # Cloud, Architecture & Data
    "GraphQL", "Microservices", "Kafka", "RabbitMQ", "DSA", "OOPS", "Machine Learning", "AI/ML",
    "Web", "Android", "iOS"
]


class ResumeParser:
    """Extracts candidate profile, contact details, experiences, skills, and educations from PDF resumes."""

    @staticmethod
    def extract_text(pdf_bytes: bytes) -> str:
        """Extract plain text from PDF bytes."""
        text_pages: List[str] = []
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text_pages.append(page_text)
        except Exception:
            pass
        return "\n\n".join(text_pages)

    @classmethod
    def _split_sections(cls, lines: List[str]) -> Dict[str, List[str]]:
        """Divide resume lines into structured sections based on recognized headings."""
        section_headers = [
            ("summary", re.compile(r"^(?:Professional\s+|Career\s+)?Summary\b|^About(?:\s+Me)?\b|^Profile\b", re.IGNORECASE)),
            ("skills", re.compile(r"^(?:Technical\s+|Core\s+|Key\s+)?Skills\b|^Technical\s+Competencies\b|^Technologies\b", re.IGNORECASE)),
            ("experience", re.compile(r"^(?:Professional\s+|Work\s+|Relevant\s+)?Experience\b|^Employment(?:\s+History)?\b|^Work\s+History\b", re.IGNORECASE)),
            ("education", re.compile(r"^Education\b|^Academic(?:\s+Qualifications|\s+Background)?\b", re.IGNORECASE)),
            ("certifications", re.compile(r"^Certifications?\b|^Licenses?\b|^Courses\b|^Training\b", re.IGNORECASE)),
            ("projects", re.compile(r"^(?:Key\s+)?Projects?\b", re.IGNORECASE)),
        ]

        sections: Dict[str, List[str]] = {"header": []}
        current_sec = "header"

        for line in lines:
            trimmed = line.strip()
            if not trimmed:
                continue

            # Check if this line is a section header (short line matching header pattern)
            matched_sec = None
            if len(trimmed.split()) <= 4:
                for sec_name, pat in section_headers:
                    if pat.search(trimmed):
                        matched_sec = sec_name
                        break

            if matched_sec:
                current_sec = matched_sec
                if current_sec not in sections:
                    sections[current_sec] = []
            else:
                sections.setdefault(current_sec, []).append(trimmed)

        return sections

    @classmethod
    def parse_pdf(cls, pdf_bytes: bytes) -> Dict[str, Any]:
        """Parse PDF resume bytes and extract structured candidate information."""
        text = cls.extract_text(pdf_bytes).strip()

        # Handle scanned or unreadable documents gracefully
        if not text or len(text.split()) < 15:
            return {
                "is_readable": False,
                "first_name": None,
                "last_name": None,
                "email": None,
                "phone": None,
                "city": None,
                "country": "India",
                "headline": None,
                "target_role": None,
                "about": None,
                "experience_years": 0,
                "experience_months": 0,
                "linkedin_url": None,
                "github_url": None,
                "website_url": None,
                "skills": [],
                "experiences": [],
                "educations": [],
                "warnings": [
                    "Resume appears scanned or contains unreadable text. Please enter or review your information manually."
                ],
            }

        raw_lines = [line.strip() for line in text.split("\n") if line.strip()]
        sections = cls._split_sections(raw_lines)
        header_lines = sections.get("header", []) + raw_lines[:6]

        # 1. Email extraction
        emails = re.findall(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", text)
        email = emails[0].lower() if emails else None

        # 2. Phone extraction
        phone_matches = re.findall(
            r"(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}", text
        )
        phone = phone_matches[0].strip() if phone_matches else None

        # 3. Social / Profile links (prefer personal resume links)
        linkedin_url: Optional[str] = None
        github_url: Optional[str] = None
        website_url: Optional[str] = None

        li_match = re.search(r"(?:https?://)?(?:www\.)?linkedin\.com/in/[a-zA-Z0-9_-]+/?", text)
        if li_match:
            linkedin_url = li_match.group(0)
            if not linkedin_url.startswith("http"):
                linkedin_url = "https://" + linkedin_url

        gh_match = re.search(r"(?:https?://)?(?:www\.)?github\.com/[a-zA-Z0-9_-]+/?", text)
        if gh_match:
            github_url = gh_match.group(0)
            if not github_url.startswith("http"):
                github_url = "https://" + github_url

        # 4. Candidate Name (heuristic: inspect top lines of header)
        first_name: Optional[str] = None
        last_name: Optional[str] = None
        ignore_name_words = {
            "resume", "curriculum", "vitae", "cv", "profile", "contact", "summary",
            "experience", "education", "page", "email", "phone", "skills"
        }

        for line in header_lines:
            # Clean symbols, icons, phone, and email remnants
            clean_line = re.sub(r"[📞📧🔗📍|•\(\)\+0-9]", "", line).strip()
            clean_line = re.sub(r"[^a-zA-Z\s]", "", clean_line).strip()
            words = clean_line.split()
            if 2 <= len(words) <= 4:
                if not any(w.lower() in ignore_name_words for w in words):
                    first_name = words[0].title()
                    last_name = " ".join(words[1:]).title()
                    break

        # 5. Location heuristics
        city: Optional[str] = None
        country: str = "India"
        location_matches = re.findall(
            r"\b(Bengaluru|Bangalore|Mumbai|Delhi|Hyderabad|Pune|Chennai|Noida|Gurugram|Gurgaon|San Francisco|New York|London|Berlin|Toronto|Singapore|India|USA|UK)\b",
            text,
            re.IGNORECASE,
        )
        if location_matches:
            matched_loc = location_matches[0].title()
            if matched_loc in {"India", "Usa", "Uk"}:
                country = matched_loc
            else:
                city = matched_loc

        # 6. Professional Bio / Summary
        about: Optional[str] = None
        if "summary" in sections and sections["summary"]:
            about = " ".join(sections["summary"]).strip()
            if len(about) > 1000:
                about = about[:1000]

        # 7. Work Experiences & Headline extraction
        experiences, experience_years = cls._extract_experiences(sections.get("experience", []), raw_lines)

        # 8. Headline / Target Role (derive from most recent job or summary)
        headline: Optional[str] = None
        if experiences:
            headline = experiences[0]["job_title"]
        elif about:
            # Check first sentence of summary for title
            first_sent = about.split(".")[0].strip()
            role_m = re.search(r"\b([A-Za-z\s]+?(?:Engineer|Developer|Lead|Architect|Manager|Analyst|Tester|Specialist|Consultant))\b", first_sent, re.IGNORECASE)
            if role_m:
                headline = role_m.group(1).strip()[:80]

        if not headline:
            headline = "Software Professional"

        # 9. Skills extraction (both from explicit skills section & dictionary match)
        skills = cls._extract_skills(sections.get("skills", []), text)

        # 10. Education extraction
        educations = cls._extract_educations(sections.get("education", []), raw_lines)

        return {
            "is_readable": True,
            "first_name": first_name,
            "last_name": last_name,
            "email": email,
            "phone": phone,
            "city": city,
            "country": country,
            "headline": headline,
            "target_role": headline,
            "about": about,
            "experience_years": experience_years,
            "experience_months": 0,
            "linkedin_url": linkedin_url,
            "github_url": github_url,
            "website_url": website_url,
            "skills": skills,
            "experiences": experiences,
            "educations": educations,
            "warnings": [],
        }

    @classmethod
    def _extract_skills(cls, skill_section_lines: List[str], full_text: str) -> List[Dict[str, Any]]:
        """Extract candidate skills directly from skills section and dictionary scan."""
        skills_found: Dict[str, Dict[str, Any]] = {}

        # A. Direct extraction from Skills section
        for line in skill_section_lines:
            content = line.strip()
            if ":" in content:
                # e.g., "Programming: Java, SQL (Basic)" -> take "Java, SQL (Basic)"
                content = content.split(":", 1)[1]

            # Split by common delimiters
            tokens = re.split(r"[,•·|;]", content)
            for token in tokens:
                # Strip parenthetical annotations like "(Basic)", "(Advanced)", "(POM)"
                cleaned = re.sub(r"\((?:Basic|Advanced|Intermediate|Expert|Fresher)\)", "", token, flags=re.I).strip()
                cleaned = cleaned.strip("•·- *")
                if 2 <= len(cleaned) <= 40:
                    key = cleaned.lower()
                    if key not in skills_found and not any(k in key for k in ["platforms", "methodologies", "tools", "testing"]):
                        skills_found[key] = {
                            "name": cleaned,
                            "years": 2,
                            "months": 0,
                            "source": "resume",
                        }

        # B. Supplement with comprehensive dictionary match
        text_lower = full_text.lower()
        for skill in TECH_SKILLS_DICTIONARY:
            key = skill.lower()
            if key not in skills_found:
                pattern = r"\b" + re.escape(key) + r"\b"
                if re.search(pattern, text_lower):
                    skills_found[key] = {
                        "name": skill,
                        "years": 2,
                        "months": 0,
                        "source": "resume",
                    }

        return list(skills_found.values())

    @classmethod
    def _extract_experiences(cls, exp_section_lines: List[str], all_lines: List[str]) -> Tuple[List[Dict[str, Any]], int]:
        """Extract job experiences strictly from the experience section."""
        experiences: List[Dict[str, Any]] = []

        # Find date ranges in lines (e.g., Oct 2025 - Present, Nov 2024 - Sep 2025)
        date_pattern = re.compile(
            r"(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(20\d{2}|19\d{2})\s*(?:-|–|to)\s*(?:(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(20\d{2}|19\d{2}|Present|Current)",
            re.IGNORECASE,
        )

        lines_to_parse = exp_section_lines if exp_section_lines else all_lines
        earliest_year: Optional[int] = None
        current_year = datetime.now().year

        current_job: Optional[Dict[str, Any]] = None

        for idx, line in enumerate(lines_to_parse):
            match = date_pattern.search(line)
            if match:
                if current_job:
                    experiences.append(current_job)
                    current_job = None

                start_year = int(match.group(2))
                end_str = match.group(4)
                end_year = current_year if "present" in end_str.lower() or "current" in end_str.lower() else int(end_str)

                if earliest_year is None or start_year < earliest_year:
                    earliest_year = start_year

                # Pattern 1: Title | Company | Location | Date on SAME line
                remaining = line[:match.start()] + line[match.end():]
                pipe_parts = [p.strip() for p in remaining.split("|") if p.strip()]

                job_title = "Software Engineer"
                company_name = "Technology Company"

                if len(pipe_parts) >= 2:
                    job_title = pipe_parts[0]
                    company_name = pipe_parts[1]
                elif len(pipe_parts) == 1:
                    # Check if previous line had the title
                    prev_line = lines_to_parse[idx - 1] if idx > 0 else ""
                    if prev_line and not any(k in prev_line.lower() for k in ["experience", "summary", "project", "education"]):
                        job_title = prev_line[:60].strip()
                        company_name = pipe_parts[0]
                    else:
                        job_title = pipe_parts[0]
                else:
                    prev_line = lines_to_parse[idx - 1] if idx > 0 else ""
                    if prev_line and not any(k in prev_line.lower() for k in ["experience", "summary", "project", "education"]):
                        job_title = prev_line[:60].strip()

                current_job = {
                    "job_title": job_title.strip(" |•-"),
                    "company_name": company_name.strip(" |•-"),
                    "start_date": f"{start_year}-01-01",
                    "end_date": f"{end_year}-12-31" if end_year != current_year else None,
                    "description": "",
                    "source": "resume",
                }
            else:
                if current_job and line.strip():
                    # Collect bullet points for current job
                    if not current_job["description"]:
                        current_job["description"] = line.strip()
                    else:
                        current_job["description"] += "\n" + line.strip()

        if current_job:
            experiences.append(current_job)

        total_years = max(0, min(40, (current_year - earliest_year))) if earliest_year else 0
        return experiences[:5], total_years

    @classmethod
    def _extract_educations(cls, edu_section_lines: List[str], all_lines: List[str]) -> List[Dict[str, Any]]:
        """Extract degree and educational institutions strictly from education section."""
        educations: List[Dict[str, Any]] = []
        degree_patterns = [
            r"\b(B\.?Tech|B\.?E\.?|B\.?S\.?|Bachelor|M\.?Tech|M\.?S\.?|Master|MBA|Ph\.?D)\b"
        ]

        lines_to_parse = edu_section_lines if edu_section_lines else all_lines
        combined_text = " ".join(lines_to_parse)

        # Check for dash-separated or pipe-separated education lines
        for pattern in degree_patterns:
            match = re.search(pattern, combined_text, re.IGNORECASE)
            if match:
                degree_name = match.group(0)
                # Split combined education text by '-'
                parts = [p.strip() for p in combined_text.split("-") if p.strip()]
                field_of_study = "Computer Science / Engineering"
                institution = "University / College"
                end_year = None

                for p in parts:
                    if any(k in p.lower() for k in ["engineering", "science", "technology", "information"]) and not any(k in p.lower() for k in ["institute", "university", "college"]):
                        field_of_study = p
                    elif any(k in p.lower() for k in ["institute", "university", "college", "school"]):
                        institution = p
                    year_m = re.search(r"\b(20\d{2}|19\d{2})\b", p)
                    if year_m:
                        end_year = year_m.group(0)

                educations.append({
                    "institution": institution[:100],
                    "degree": degree_name,
                    "field_of_study": field_of_study[:100],
                    "start_year": None,
                    "end_year": end_year,
                    "source": "resume",
                })
                break

        return educations[:3]

