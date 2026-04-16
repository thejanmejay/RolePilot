"""PDF resume parser using pdfplumber."""

from __future__ import annotations

from pathlib import Path
from typing import Optional

from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)


def extract_resume_text(resume_path: str | Path) -> Optional[str]:
    """Extract all text from a PDF resume.

    Returns the full text content, or None if parsing fails.
    """
    path = Path(resume_path)
    if not path.exists():
        log.warning("Resume file not found: %s", path)
        return None

    try:
        import pdfplumber

        text_parts = []
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)

        full_text = "\n".join(text_parts)
        log.info("Extracted %d characters from resume (%d pages)", len(full_text), len(text_parts))
        return full_text

    except ImportError:
        log.error("pdfplumber not installed. Run: pip install pdfplumber")
        return None
    except Exception as e:
        log.error("Failed to parse resume: %s", e)
        return None


def extract_skills(resume_text: str) -> list[str]:
    """Extract a simple list of skills from resume text.

    Uses common section headers to find the skills section.
    """
    import re

    lines = resume_text.split("\n")
    skills: list[str] = []
    in_skills_section = False

    for line in lines:
        stripped = line.strip()
        # Detect skills section headers
        if re.match(r"(?i)^(technical\s+)?skills?\s*:?$", stripped):
            in_skills_section = True
            continue
        # Stop at next section header
        if in_skills_section and re.match(r"(?i)^(experience|education|projects|certifications?|summary)\s*:?$", stripped):
            break
        if in_skills_section and stripped:
            # Split by common delimiters
            parts = re.split(r"[,;|•·\-]", stripped)
            for part in parts:
                skill = part.strip()
                if skill and len(skill) > 1 and len(skill) < 50:
                    skills.append(skill)

    log.debug("Extracted %d skills from resume", len(skills))
    return skills
