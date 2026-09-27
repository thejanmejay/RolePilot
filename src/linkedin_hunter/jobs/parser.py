"""Parse job cards from LinkedIn search results HTML."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Optional

from playwright.async_api import Page, ElementHandle

from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)


@dataclass
class JobCard:
    linkedin_id: str
    title: str
    company: str
    location: str = ""
    url: str = ""
    easy_apply: bool = False
    remote: str = ""
    posted_date: str = ""
    salary: str = ""
    already_applied: bool = False


# Selectors for LinkedIn job search results (2025 layout)
SELECTORS = {
    "job_cards": "li[data-occludable-job-id], li.jobs-search-results__list-item",
    "title": "a.job-card-list__title--link, a.job-card-container__link, a[data-control-name='job_card_title'], a[href*='/jobs/view/']",
    "company": "div.artdeco-entity-lockup__subtitle span, span.job-card-container__primary-description, .job-card-container__company-name, div.artdeco-entity-lockup__subtitle",
    "location": "div.artdeco-entity-lockup__caption li span, ul.job-card-container__metadata-wrapper li, div.artdeco-entity-lockup__caption",
    "easy_apply_badge": "svg[data-test-icon*='linkedin-bug'], li.job-card-container__footer-item",
    "posted_date": "time",
    "salary": "span.job-card-container__metadata-item--salary",
}


def _extract_job_id(element_id: str = "", url: str = "") -> str:
    """Extract LinkedIn job ID from data attributes or URL."""
    # Try from element data attribute (e.g., "ember123" or direct job ID)
    if element_id:
        match = re.search(r"(\d{5,})", element_id)
        if match:
            return match.group(1)

    # Try from URL
    if url:
        match = re.search(r"/jobs/view/(\d+)", url)
        if match:
            return match.group(1)
        match = re.search(r"currentJobId=(\d+)", url)
        if match:
            return match.group(1)

    return ""


async def _safe_text(element: Optional[ElementHandle], selector: str) -> str:
    """Safely extract text content from a child element."""
    if not element:
        return ""
    child = await element.query_selector(selector)
    if not child:
        return ""
    text = await child.text_content()
    return (text or "").strip()


async def parse_job_cards(page: Page) -> list[JobCard]:
    """Parse all visible job cards currently mounted in the search results DOM."""
    cards: list[JobCard] = []

    job_elements = await page.query_selector_all(SELECTORS["job_cards"])
    log.debug("Found %d job card elements mounted on page", len(job_elements))

    for idx, elem in enumerate(job_elements):
        try:
            # Get title and URL
            title_el = await elem.query_selector(SELECTORS["title"])
            title = ""
            url = ""
            if title_el:
                # Use the visible span to get clean title text
                visible_span = await title_el.query_selector("span[aria-hidden='true']")
                if visible_span:
                    title = ((await visible_span.text_content()) or "").strip()
                else:
                    # Fallback to aria-label, stripping common suffixes
                    title = (await title_el.get_attribute("aria-label")) or ""
                    title = re.sub(r"\s+with\s+verification$", "", title).strip()
                if not title:
                    title = ((await title_el.text_content()) or "").strip()
                url = (await title_el.get_attribute("href")) or ""
                if url and not url.startswith("http"):
                    url = "https://www.linkedin.com" + url

            # Fallback title if element contains an inner link with text
            if not title:
                inner_link = await elem.query_selector("a")
                if inner_link:
                    title = ((await inner_link.text_content()) or "").strip()
                    url = (await inner_link.get_attribute("href")) or ""
                    if url and not url.startswith("http"):
                        url = "https://www.linkedin.com" + url

            # Get company
            company = await _safe_text(elem, SELECTORS["company"])
            if not company:
                company = "Unknown"

            # Get location
            location = await _safe_text(elem, SELECTORS["location"])

            # Check Easy Apply by looking for the LinkedIn bug icon or "Easy Apply" text
            easy_apply = False
            ea_icon = await elem.query_selector("svg[data-test-icon*='linkedin-bug']")
            if ea_icon:
                easy_apply = True
            else:
                footer_items = await elem.query_selector_all("li.job-card-container__footer-item")
                for fi in footer_items:
                    fi_text = ((await fi.text_content()) or "").strip()
                    if "easy apply" in fi_text.lower():
                        easy_apply = True
                        break

            # Check if already applied on LinkedIn (e.g. "Applied 43m ago", "Applied")
            already_applied = False
            footer_items = await elem.query_selector_all(
                "li.job-card-container__footer-item, span.job-card-container__footer-item, span.artdeco-inline-feedback__message"
            )
            for fi in footer_items:
                fi_text = ((await fi.text_content()) or "").strip()
                if not fi_text:
                    continue
                # Match "Applied", "Applied 3d ago", "Applied yesterday", etc. but ignore "Easy Apply"
                if re.match(r"(?i)^applied(?:\s+(?:\d+\s*(?:m|h|d|w|mo|month|year|day|hour|minute)s?\s+ago|just\s+now|today|yesterday|on\s+[A-Za-z]+|\d{1,2}/\d{1,2}/\d{2,4}))?$", fi_text):
                    already_applied = True
                    break

            # Get job ID — directly from the li attribute
            linkedin_id = (await elem.get_attribute("data-occludable-job-id")) or ""
            if not linkedin_id:
                # Fallback: extract from data-job-id on inner div
                inner = await elem.query_selector("div[data-job-id]")
                if inner:
                    linkedin_id = (await inner.get_attribute("data-job-id")) or ""
            if not linkedin_id:
                linkedin_id = _extract_job_id("", url)

            if not linkedin_id and url:
                # Fallback: hash the URL
                linkedin_id = str(hash(url))[:12]

            # Get posted date
            time_el = await elem.query_selector(SELECTORS["posted_date"])
            posted_date = ""
            if time_el:
                posted_date = (await time_el.get_attribute("datetime")) or ""
                if not posted_date:
                    posted_date = ((await time_el.text_content()) or "").strip()

            # Get salary if shown
            salary = await _safe_text(elem, SELECTORS["salary"])

            if title:
                card = JobCard(
                    linkedin_id=linkedin_id or str(hash(f"{title}{company}"))[:12],
                    title=title,
                    company=company,
                    location=location,
                    url=url,
                    easy_apply=easy_apply,
                    posted_date=posted_date,
                    salary=salary,
                    already_applied=already_applied,
                )
                cards.append(card)
                log.info(
                    "[CARD-DIAG] index=%d id=%s title=%r company=%r already_applied=%s easy_apply=%s",
                    idx,
                    card.linkedin_id,
                    card.title,
                    card.company,
                    card.already_applied,
                    card.easy_apply,
                )
            else:
                log.warning("[CARD-DIAG-DISCARD] index=%d missing title (id=%r company=%r)", idx, linkedin_id, company)

        except Exception as e:
            log.warning("Failed to parse a job card at index %d: %s", idx, e)
            continue

    return cards
