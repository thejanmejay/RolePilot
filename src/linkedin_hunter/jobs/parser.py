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


# Selectors for LinkedIn job search results (2025 layout)
SELECTORS = {
    "job_cards": "li[data-occludable-job-id]",
    "title": "a.job-card-list__title--link, a.job-card-container__link",
    "company": "div.artdeco-entity-lockup__subtitle span",
    "location": "div.artdeco-entity-lockup__caption li span",
    "easy_apply_badge": "svg[data-test-icon*='linkedin-bug'], li.job-card-container__footer-item",
    "posted_date": "time",
    "salary": "span.job-card-container__metadata-item--salary",
}


def _extract_job_id(element_id: str = "", url: str = "") -> str:
    """Extract LinkedIn job ID from data attributes or URL."""
    # Try from element data attribute (e.g., "ember123" or direct job ID)
    if element_id:
        # Pattern: numbers in the element id
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
    """Parse all visible job cards on the current search results page."""
    import asyncio
    cards: list[JobCard] = []

    # Scroll through the job list to un-occlude all cards
    job_list = await page.query_selector("ul.scaffold-layout__list-container") or \
               await page.query_selector("div.scaffold-layout__list ul")
    if job_list:
        # Scroll the job list container to reveal all items
        await page.evaluate("""(list) => {
            return new Promise(resolve => {
                let scrollTop = 0;
                const step = 200;
                const interval = setInterval(() => {
                    list.scrollTop += step;
                    if (list.scrollTop >= list.scrollHeight - list.clientHeight || scrollTop === list.scrollTop) {
                        clearInterval(interval);
                        resolve();
                    }
                    scrollTop = list.scrollTop;
                }, 100);
            });
        }""", job_list)
        await asyncio.sleep(1)

    job_elements = await page.query_selector_all(SELECTORS["job_cards"])
    log.info("Found %d job card elements on page", len(job_elements))

    for elem in job_elements:
        # Scroll element into view to force it to render
        try:
            await elem.scroll_into_view_if_needed()
            await asyncio.sleep(0.15)
        except Exception:
            pass
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

            # Get company
            company = await _safe_text(elem, SELECTORS["company"])

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

            if title and company:
                card = JobCard(
                    linkedin_id=linkedin_id or str(hash(f"{title}{company}"))[:12],
                    title=title,
                    company=company,
                    location=location,
                    url=url,
                    easy_apply=easy_apply,
                    posted_date=posted_date,
                    salary=salary,
                )
                cards.append(card)
                log.debug("Parsed job: %s at %s (ID: %s)", title, company, card.linkedin_id)

        except Exception as e:
            log.warning("Failed to parse a job card: %s", e)
            continue

    return cards
