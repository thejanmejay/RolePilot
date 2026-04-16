"""Workday application orchestrator — multi-page wizard flow.

Handles the full Workday application lifecycle:
  1. Navigate to a Workday job URL
  2. Click "Apply"
  3. Walk through the multi-page form (My Information → Experience → Questions → Disclosures → Review)
  4. Fill fields on each page using the Workday-specific filler
  5. Submit the application
"""

from __future__ import annotations

import asyncio
import random

from rich.console import Console

from linkedin_hunter.auth.session import load_cookies, has_valid_session
from linkedin_hunter.browser.engine import BrowserEngine
from linkedin_hunter.browser.humanize import human_delay, short_delay
from linkedin_hunter.config import HunterConfig, get_project_root
from linkedin_hunter.forms.resume import extract_resume_text
from linkedin_hunter.utils.logging import get_logger
from linkedin_hunter.utils.shutdown import (
    install_signal_handlers, is_shutting_down, reset as reset_shutdown,
)
from linkedin_hunter.workday.constants import (
    PAGE_SELECTORS, WORKDAY_DELAYS, is_workday_url, extract_company_from_url,
)
from linkedin_hunter.workday.detector import (
    detect_current_page, detect_workday_fields, WorkdayPage,
)
from linkedin_hunter.workday.filler import fill_workday_fields

log = get_logger(__name__)
console = Console()

MAX_PAGES = 15  # Safety limit on wizard steps


async def run_workday_apply(
    config: HunterConfig,
    urls: list[str],
    dry_run: bool = False,
) -> None:
    """Apply to one or more Workday job URLs.

    Args:
        config: Hunter configuration.
        urls: List of Workday job URLs to apply to.
        dry_run: If True, walk through forms without submitting.
    """
    reset_shutdown()
    install_signal_handlers()

    if not urls:
        console.print("[red]No Workday URLs provided.[/red]")
        return

    # Validate URLs
    valid_urls = []
    for url in urls:
        if is_workday_url(url):
            valid_urls.append(url)
        else:
            console.print(f"[yellow]Skipping non-Workday URL: {url}[/yellow]")

    if not valid_urls:
        console.print("[red]No valid Workday URLs to process.[/red]")
        return

    # Pre-parse resume
    root = get_project_root()
    resume_path = root / config.profile.resume_path
    resume_text = extract_resume_text(resume_path) if resume_path.exists() else None
    if resume_text:
        console.print(f"  [green]Loaded resume[/green]: {resume_path.name} ({len(resume_text)} chars)")

    mode = "[yellow]DRY RUN[/yellow] " if dry_run else ""
    engine = BrowserEngine(config)

    try:
        page = await engine.launch(headless=False)

        console.print(f"\n{mode}[bold]Starting Workday Apply session[/bold]")
        console.print(f"  Jobs: {len(valid_urls)}")
        console.print()

        applied = 0
        failed = 0

        for i, url in enumerate(valid_urls):
            if is_shutting_down():
                console.print("\n[bold yellow]Shutdown requested — stopping[/bold yellow]")
                break

            company = extract_company_from_url(url)
            console.print(f"\n[bold][{i+1}/{len(valid_urls)}] Applying to {company}[/bold]")
            console.print(f"  URL: {url}")

            try:
                success = await _apply_to_workday_job(
                    page, url, config, resume_text=resume_text, dry_run=dry_run,
                )
                if success:
                    applied += 1
                    console.print(f"  [green]{'Would apply' if dry_run else 'Applied'}![/green]")
                else:
                    failed += 1
                    console.print(f"  [red]Failed to complete application[/red]")

            except Exception as e:
                log.exception("Error applying to Workday job %s", url)
                console.print(f"  [red]Error: {e}[/red]")
                failed += 1

            # Delay between applications
            if i < len(valid_urls) - 1:
                delay = random.uniform(
                    config.apply.delay_min, config.apply.delay_max
                )
                for _ in range(int(delay) + 1):
                    if is_shutting_down():
                        break
                    await asyncio.sleep(min(1.0, delay))
                    delay -= 1.0
                    if delay <= 0:
                        break

        # Summary
        console.print("\n" + "=" * 50)
        console.print(f"[bold]Workday Session Summary ({mode.strip() or 'LIVE'})[/bold]")
        console.print(f"  Applied:  [green]{applied}[/green]")
        console.print(f"  Failed:   [red]{failed}[/red]")
        console.print(f"  Total:    {len(valid_urls)}")

    except Exception as e:
        console.print(f"[bold red]Workday session error: {e}[/bold red]")
        log.exception("Workday session failed")

    finally:
        await engine.close()


async def _apply_to_workday_job(
    page,
    url: str,
    config: HunterConfig,
    resume_text: str | None = None,
    dry_run: bool = False,
) -> bool:
    """Apply to a single Workday job posting.

    Returns True if the application was submitted.
    """
    # Navigate to the job page
    await page.goto(url, wait_until="domcontentloaded")
    await human_delay()

    # Look for and click the Apply button
    apply_clicked = await _click_apply_button(page)
    if not apply_clicked:
        log.warning("Could not find Apply button on %s", url)
        return False

    await asyncio.sleep(random.uniform(2, 4))

    # Check if we need to create an account or sign in
    login_needed = await _check_login_required(page)
    if login_needed:
        console.print("  [yellow]Account login required — waiting for manual login (60s)...[/yellow]")
        console.print("  [dim]Please sign in to the Workday portal in the browser[/dim]")
        # Wait for login with periodic checks
        for _ in range(60):
            if is_shutting_down():
                return False
            await asyncio.sleep(1)
            # Check if we're past the login page
            if not await _check_login_required(page):
                console.print("  [green]Login detected![/green]")
                await asyncio.sleep(2)
                break
        else:
            console.print("  [red]Login timeout — skipping[/red]")
            return False

    # Process the multi-page application wizard
    return await _process_workday_wizard(page, config, resume_text, dry_run)


async def _click_apply_button(page) -> bool:
    """Find and click the Apply button on a Workday job posting page."""
    # Try various Apply button selectors
    apply_selectors = [
        "a[data-automation-id='jobPostingApplyButton']",
        "button[data-automation-id='jobPostingApplyButton']",
        "a[aria-label*='Apply']",
        "button[aria-label*='Apply']",
        "a:has-text('Apply')",
        "button:has-text('Apply')",
    ]

    for selector in apply_selectors:
        try:
            btn = await page.query_selector(selector)
            if btn and await btn.is_visible():
                text = ((await btn.text_content()) or "").strip().lower()
                # Make sure it's not "Applied" or "Apply Filters"
                if "appl" in text and "filter" not in text and text != "applied":
                    await btn.click()
                    log.info("Clicked Workday Apply button: '%s'", text)
                    return True
        except Exception:
            continue

    return False


async def _check_login_required(page) -> bool:
    """Check if the current page is a login/sign-in page."""
    login_indicators = [
        "input[data-automation-id='email']",
        "input[type='password']",
        "button[data-automation-id='signInButton']",
        "[data-automation-id='createAccountLink']",
        "a:has-text('Sign In')",
        "a:has-text('Create Account')",
    ]
    for sel in login_indicators:
        try:
            el = await page.query_selector(sel)
            if el and await el.is_visible():
                return True
        except Exception:
            continue
    return False


async def _process_workday_wizard(
    page,
    config: HunterConfig,
    resume_text: str | None = None,
    dry_run: bool = False,
) -> bool:
    """Walk through the multi-page Workday application wizard.

    Returns True if the application was submitted.
    """
    prev_page = None
    stuck_count = 0

    for step in range(MAX_PAGES):
        if is_shutting_down():
            return False

        # Wait for page content to settle
        await asyncio.sleep(random.uniform(*WORKDAY_DELAYS["between_pages"]))

        # Detect which page we're on
        current_page = await detect_current_page(page)
        console.print(f"  [cyan]Step {step+1}:[/cyan] {current_page.value.replace('_', ' ').title()}")

        # Stuck detection
        if current_page == prev_page:
            stuck_count += 1
        else:
            stuck_count = 0
        prev_page = current_page

        if stuck_count >= 3:
            log.warning("Stuck on page '%s' for %d steps, giving up", current_page.value, stuck_count)
            console.print(f"  [yellow]Stuck on {current_page.value} — unable to proceed[/yellow]")
            return False

        # Check for validation errors
        errors = await page.query_selector_all(PAGE_SELECTORS["error_message"])
        if errors and stuck_count >= 2:
            error_texts = []
            for err in errors:
                text = (await err.text_content() or "").strip()
                if text:
                    error_texts.append(text)
            if error_texts:
                console.print(f"  [red]Errors: {'; '.join(error_texts[:3])}[/red]")
            return False

        # Review/Submit page
        if current_page == WorkdayPage.REVIEW:
            if dry_run:
                console.print("  [yellow]DRY RUN: Would submit here[/yellow]")
                return True
            return await _submit_application(page)

        # Detect and fill fields
        fields = await detect_workday_fields(page)
        if fields:
            filled, skipped = await fill_workday_fields(
                page, fields, config, resume_text=resume_text,
            )
            console.print(f"  [dim]Filled {filled} fields, skipped {skipped}[/dim]")

        await short_delay()

        # Click Next / Save & Continue
        next_clicked = await _click_next_button(page)
        if not next_clicked:
            # Check if we're on the submit page
            submit_available = await _is_submit_page(page)
            if submit_available:
                if dry_run:
                    console.print("  [yellow]DRY RUN: Would submit here[/yellow]")
                    return True
                return await _submit_application(page)

            log.warning("No Next button found at step %d", step + 1)
            # Try pressing Enter as fallback
            await page.keyboard.press("Enter")
            await asyncio.sleep(2)

    log.warning("Exhausted max pages (%d)", MAX_PAGES)
    return False


async def _click_next_button(page) -> bool:
    """Click the Next / Save & Continue button."""
    try:
        btn = await page.query_selector(PAGE_SELECTORS["next_button"])
        if btn and await btn.is_visible():
            text = ((await btn.text_content()) or "").strip().lower()
            # Don't click Submit as Next — handle that separately
            if "submit" in text:
                return False
            await btn.click()
            log.info("Clicked Workday Next button: '%s'", text)
            await asyncio.sleep(1.5)
            return True
    except Exception as e:
        log.warning("Error clicking Next: %s", e)
    return False


async def _is_submit_page(page) -> bool:
    """Check if we're on the final submit page."""
    try:
        btn = await page.query_selector(PAGE_SELECTORS["submit_button"])
        if btn and await btn.is_visible():
            text = ((await btn.text_content()) or "").strip().lower()
            return "submit" in text
    except Exception:
        pass
    return False


async def _submit_application(page) -> bool:
    """Click the Submit button to complete the application."""
    try:
        # Add a deliberate delay before submitting
        await asyncio.sleep(random.uniform(*WORKDAY_DELAYS["before_submit"]))

        btn = await page.query_selector(PAGE_SELECTORS["submit_button"])
        if btn and await btn.is_visible():
            await btn.click()
            log.info("Submitted Workday application")
            await asyncio.sleep(3)

            # Check for confirmation
            body_text = ((await page.text_content("body")) or "").lower()
            if any(kw in body_text for kw in ["thank you", "submitted", "received", "confirmation"]):
                log.info("Workday application confirmed")
                return True

            # Even without explicit confirmation, the click succeeded
            return True

    except Exception as e:
        log.warning("Error submitting Workday application: %s", e)
    return False
