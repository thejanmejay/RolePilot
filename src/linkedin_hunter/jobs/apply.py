"""Easy Apply bot: multi-step modal form handling."""

from __future__ import annotations

import asyncio
from pathlib import Path
import random
import re
from typing import Any, Callable, Dict, Optional

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from linkedin_hunter.auth.session import load_cookies, has_valid_session
from linkedin_hunter.browser.engine import BrowserEngine
from linkedin_hunter.browser.humanize import human_delay, short_delay, smooth_scroll, random_mouse_jiggle
from linkedin_hunter.config import HunterConfig, get_project_root
from linkedin_hunter.db.models import init_db
from linkedin_hunter.db.repository import JobRepository, ActivityRepository
from linkedin_hunter.forms.detector import detect_form_fields, FieldType
from linkedin_hunter.forms.filler import fill_form_fields, _fill_field
from linkedin_hunter.forms.resume import extract_resume_text
from linkedin_hunter.jobs.filters import build_search_url
from linkedin_hunter.jobs.parser import parse_job_cards, JobCard
from linkedin_hunter.jobs.search import collect_search_jobs
from linkedin_hunter.tracker.tracker import ApplicationTracker
from linkedin_hunter.utils.logging import get_logger
from linkedin_hunter.utils.rate_limiter import RateLimiter
from linkedin_hunter.utils.shutdown import install_signal_handlers, is_shutting_down, reset as reset_shutdown
from linkedin_hunter.workday.constants import is_workday_url

log = get_logger(__name__)
console = Console()

# Selectors for Easy Apply flow (2025 LinkedIn layout)
APPLY_SELECTORS = {
    # The Easy Apply button in the job detail pane (right side of two-pane view)
    "easy_apply_button": "button.jobs-apply-button",
    # The Easy Apply modal container
    "modal": "div.jobs-easy-apply-modal, div.jobs-easy-apply-content, div[data-test-modal-id='easy-apply-modal'], div.artdeco-modal[role='dialog'], div[role='dialog']",
    # Navigation buttons inside the modal footer
    "next_button": "div.jobs-easy-apply-modal footer button.artdeco-button--primary, div.jobs-easy-apply-content footer button.artdeco-button--primary, div[role='dialog'] footer button.artdeco-button--primary, button[aria-label*='Submit' i], button[aria-label*='Review' i], button[aria-label*='Next' i]",
    "dismiss_button": "button[aria-label='Dismiss'], button.artdeco-modal__dismiss, button[data-test-modal-close-btn]",
    "error_message": "div.artdeco-inline-feedback--error",
    "follow_checkbox": "label[for='follow-company-checkbox']",
    # Job card in the left-pane list
    "job_card_link": "a.job-card-list__title--link, a.job-card-container__link",
}

MAX_FORM_STEPS = 10  # Safety limit on modal steps


async def run_apply(
    config: HunterConfig,
    limit: int = 15,
    dry_run: bool = False,
    cookies: Optional[list[dict]] = None,
) -> None:
    """Main apply flow: search for Easy Apply jobs and apply to them.

    Uses the two-pane search results view: click job cards in left list,
    then click Easy Apply in the right detail pane.
    """
    # Install signal handlers for graceful shutdown
    reset_shutdown()
    install_signal_handlers()

    active_cookies = cookies if cookies is not None else load_cookies()
    if not has_valid_session(active_cookies):
        console.print("[bold red]No valid session. Connect LinkedIn in RolePilot or run 'linkedin-hunter login' first.[/bold red]")
        return

    if not active_cookies:
        return

    root = get_project_root()
    conn = init_db(str(root / "data" / "hunter.db"))
    job_repo = JobRepository(conn)
    act_repo = ActivityRepository(conn)
    tracker = ApplicationTracker(conn, config.apply)
    tracker.config.limit = limit

    # Pre-parse resume for form filling
    resume_path = root / config.profile.resume_path
    resume_text = extract_resume_text(resume_path) if resume_path.exists() else None
    if resume_text:
        console.print(f"  [green]Loaded resume[/green]: {resume_path.name} ({len(resume_text)} chars)")

    # Rate limiter: ~10 applications per 10 minutes max
    rate_limiter = RateLimiter(rate=10, per=600, burst=3)

    engine = BrowserEngine(config)
    mode = "[yellow]DRY RUN[/yellow] " if dry_run else ""

    try:
        page = await engine.launch(headless=False)  # Always non-headless for apply
        await engine.load_cookies(active_cookies)

        console.print(f"\n{mode}[bold]Starting Apply session[/bold]")
        console.print(f"  Keywords: {config.search.keywords}")
        console.print(f"  Max Search Target: {config.search.max_jobs} jobs")
        console.print(f"  Run Limit: {limit} applications")
        console.print(f"  Daily Limit: {config.apply.daily_limit} applications")
        console.print(f"  Mode: {'Easy Apply only' if config.search.easy_apply_only else 'All jobs (Easy Apply + External like Workday)'}")
        console.print()

        # Step 1: Collect up to config.search.max_jobs unique cards across pages
        unique_cards = await collect_search_jobs(page, config, target_count=config.search.max_jobs)
        if not unique_cards:
            console.print("[yellow]No jobs collected from search.[/yellow]")
            return

        # Save all discovered jobs to DB
        for card in unique_cards:
            job_repo.upsert_job(
                linkedin_id=card.linkedin_id,
                title=card.title,
                company=card.company,
                location=card.location,
                url=card.url,
                easy_apply=card.easy_apply,
                posted_date=card.posted_date,
                salary=card.salary,
                search_keywords=config.search.keywords,
            )

        # Step 2: Classify all collected jobs
        already_applied_cards: list[tuple[JobCard, dict]] = []
        blacklisted_cards: list[tuple[JobCard, dict, str]] = []
        eligible_cards: list[tuple[JobCard, dict]] = []

        for card in unique_cards:
            db_job = job_repo.get_job_by_linkedin_id(card.linkedin_id)
            if not db_job:
                continue

            # Check if already applied (from LinkedIn badge or local DB)
            if card.already_applied or tracker.app_repo.was_applied(db_job["id"]):
                already_applied_cards.append((card, db_job))
                tracker.record_skipped(db_job["id"], "already applied")
                if card.already_applied:
                    tracker.app_repo.record_application(
                        db_job["id"], status="already_applied", error_message="already applied on LinkedIn", dry_run=False
                    )
                continue

            # Check blacklist rules
            skip_reason = tracker.should_skip_job(db_job)
            if skip_reason:
                blacklisted_cards.append((card, db_job, skip_reason))
                tracker.record_skipped(db_job["id"], skip_reason)
                continue

            eligible_cards.append((card, db_job))

        # Print classification summary
        console.print("\n" + "=" * 50)
        console.print("[bold]Application filtering:[/bold]")
        console.print(f"  Total Collected:  {len(unique_cards)}")
        console.print(f"  Already Applied:  {len(already_applied_cards)}")
        console.print(f"  Blacklisted:      {len(blacklisted_cards)}")
        console.print(f"  Eligible:         [green]{len(eligible_cards)}[/green]")
        console.print("=" * 50)

        # Plan applications up to limit
        to_process = min(len(eligible_cards), limit)
        console.print(f"\n[bold]Application limit:[/bold]")
        console.print(f"  Eligible:   {len(eligible_cards)}")
        console.print(f"  Run limit:  {limit}")
        console.print(f"  To process: [green]{to_process}[/green]\n")

        if to_process == 0:
            console.print("[yellow]No new eligible jobs to process in this session.[/yellow]")

        # Step 3: Process eligible jobs
        for i, (card, db_job) in enumerate(eligible_cards[:limit]):
            # Check for shutdown request (Ctrl+C / stop)
            if is_shutting_down():
                console.print("\n[bold yellow]Shutdown requested — stopping apply session[/bold yellow]")
                break

            # Check limits (session limit or daily limit)
            limit_reason = tracker.check_limits()
            if limit_reason:
                console.print(f"\n[yellow]Stopping: {limit_reason}[/yellow]")
                break

            # Check mandatory break
            if tracker.needs_break():
                console.print(f"\n[cyan]Taking a {config.apply.break_duration}s break...[/cyan]")
                for _ in range(config.apply.break_duration):
                    if is_shutting_down():
                        break
                    await asyncio.sleep(1)

            # Rate limit
            await rate_limiter.acquire()

            console.print(f"\n[bold][{i+1}/{to_process}] {card.title}[/bold] @ [green]{card.company}[/green] [dim](Job ID: {card.linkedin_id})[/dim]")
            log.info("[%d/%d] %s @ %s (Job ID: %s)", i + 1, to_process, card.title, card.company, card.linkedin_id)

            try:
                # Open the job (click card in list or navigate to URL)
                opened = await _open_job(page, card)
                if not opened:
                    console.print("  [red]Could not open job[/red]")
                    tracker.record_failed(db_job["id"], "could not open job")
                    continue

                await asyncio.sleep(random.uniform(2, 4))

                # Check if right detail pane indicates already applied on LinkedIn
                if await _is_already_applied_on_page(page):
                    console.print(f"  [dim]Skip: {card.title} @ {card.company} (already applied on LinkedIn)[/dim]")
                    tracker.record_skipped(db_job["id"], "already applied on LinkedIn")
                    tracker.app_repo.record_application(
                        db_job["id"], status="already_applied", error_message="already applied on LinkedIn", dry_run=False
                    )
                    continue

                # Try Easy Apply first
                easy_apply_found = await _click_easy_apply(page)

                if easy_apply_found:
                    # Standard Easy Apply modal flow
                    await short_delay()
                    applied = await _process_application_modal(page, config, dry_run=dry_run, resume_text=resume_text)
                else:
                    # No Easy Apply → try external Apply button (could be Workday, etc.)
                    applied = await _try_external_apply(
                        page, engine, config, resume_text=resume_text, dry_run=dry_run,
                    )

                if applied:
                    tracker.record_applied(db_job["id"], dry_run=dry_run)
                    console.print(f"  [green]{'Would apply' if dry_run else 'Applied'}![/green]")
                    act_repo.bump_daily_stat("applications")
                else:
                    tracker.record_failed(db_job["id"], "form processing failed")
                    console.print("  [red]Failed to complete application[/red]")

            except Exception as e:
                log.exception("Error applying to %s", card.title)
                tracker.record_failed(db_job["id"], str(e))
                console.print(f"  [red]Error: {e}[/red]")
                # Dismiss any open modal
                await _dismiss_modal(page)

            # Cooldown between applications (interruptible)
            delay = random.uniform(config.apply.delay_min, config.apply.delay_max)
            for _ in range(int(delay) + 1):
                if is_shutting_down():
                    break
                await asyncio.sleep(min(1.0, delay))
                delay -= 1.0
                if delay <= 0:
                    break

        # Session summary
        act_repo.log(
            "apply",
            f"applied={tracker.stats.applied}, skipped={tracker.stats.skipped}, "
            f"failed={tracker.stats.failed}, dry_run={dry_run}",
        )

        console.print("\n" + "=" * 50)
        console.print(f"[bold]Session Summary ({mode.strip() or 'LIVE'})[/bold]")
        applied_label = "Would Apply:    " if dry_run else "Applied:        "
        console.print(f"  {applied_label} [green]{tracker.stats.applied}[/green]")
        if tracker.stats.already_applied:
            console.print(f"  Already Applied: {tracker.stats.already_applied}")
        if tracker.stats.blacklisted:
            console.print(f"  Blacklisted:     {tracker.stats.blacklisted}")
        other_skips = tracker.stats.skipped - tracker.stats.already_applied - tracker.stats.blacklisted
        if other_skips > 0:
            console.print(f"  Other Skips:     {other_skips}")
        console.print(f"  Failed:          [red]{tracker.stats.failed}[/red]")
        console.print(f"  Total Processed: {tracker.stats.total_processed}")
        if not dry_run and tracker.stats.total_processed:
            console.print(f"  Success Rate:    {tracker.stats.success_rate:.0f}%")

    except Exception as e:
        console.print(f"[bold red]Apply session error: {e}[/bold red]")
        log.exception("Apply session failed")

    finally:
        await engine.close()
        conn.close()


async def _open_job(page, card: JobCard) -> bool:
    """Open a job for applying. Tries clicking the card in search list first, falls back to direct URL navigation."""
    try:
        # 1. Try finding and clicking the card in the current DOM list
        card_li = await page.query_selector(f'li[data-occludable-job-id="{card.linkedin_id}"]')
        if card_li:
            await card_li.scroll_into_view_if_needed()
            await asyncio.sleep(0.3)
            link = await card_li.query_selector("a.job-card-list__title--link, a.job-card-container__link")
            if link:
                await link.click()
            else:
                await card_li.click()
            return True

        # 2. Fall back to direct URL navigation if card is from another page
        if card.url:
            log.info("Job card %s not in current DOM view, navigating directly to: %s", card.linkedin_id, card.url)
            await page.goto(card.url, wait_until="domcontentloaded")
            await asyncio.sleep(1.5)
            return True

        log.warning("Could not open job %s (no DOM card and no URL)", card.linkedin_id)
        return False
    except Exception as e:
        log.warning("Failed to open job %s: %s", card.linkedin_id, e)
        return False


async def _is_already_applied_on_page(page) -> bool:
    """Check if the job detail pane indicates this job was already applied to."""
    try:
        selectors = [
            "span.artdeco-inline-feedback__message",
            "div.jobs-apply-button--top-card",
            "div.jobs-s-apply",
            "div.job-details-jobs-unified-top-card__primary-description-container span",
            "div.job-details-jobs-unified-top-card__actions-container",
            "span.jobs-details__applied-text",
        ]
        for sel in selectors:
            elements = await page.query_selector_all(sel)
            for el in elements:
                text = ((await el.text_content()) or "").strip()
                if not text:
                    continue
                # Clean out action button text to prevent false positives
                cleaned = re.sub(r"(?i)easy\s+apply|apply\s+now|apply\s+on\s+company\s+website", "", text).strip()
                if not cleaned:
                    continue
                # Strict match: "Applied 43m ago", "Applied yesterday", "Applied", etc.
                if re.search(r"(?i)\bapplied\s+(?:\d+\s*(?:m|h|d|w|mo|month|year|day|hour|minute)s?\s+ago|just\s+now|today|yesterday|on\s+[A-Za-z]+|\d{1,2}/\d{1,2}/\d{2,4})\b", cleaned) or re.match(r"(?i)^applied$", cleaned):
                    log.info("Job detail pane shows 'Applied' status: %r", text[:60])
                    return True
        return False
    except Exception as e:
        log.debug("Error checking already applied status on page: %s", e)
        return False


async def _click_easy_apply(page) -> bool:
    """Find and click the Easy Apply button in the job detail pane or standalone page."""
    try:
        candidate_selectors = [
            "button:has-text('Easy Apply')",
            "button[aria-label*='Easy Apply' i]",
            "button.jobs-apply-button",
            "div.jobs-apply-button--top-card button",
            "div.job-details-jobs-unified-top-card__actions-container button",
            "div.jobs-s-apply button",
            "button.artdeco-button--primary",
            "button",
        ]
        for sel in candidate_selectors:
            btns = await page.query_selector_all(sel)
            for btn in btns:
                try:
                    if not await btn.is_visible():
                        continue
                    aria = ((await btn.get_attribute("aria-label")) or "").strip().lower()
                    text = ((await btn.text_content()) or "").strip().lower()
                    if "easy apply" in aria or "easy apply" in text:
                        await btn.scroll_into_view_if_needed()
                        await asyncio.sleep(0.5)
                        await btn.click(force=True)
                        await asyncio.sleep(2.0)
                        return True
                except Exception:
                    continue
    except Exception as e:
        log.warning("Easy Apply button not found: %s", e)
    return False


async def _try_external_apply(
    page,
    engine: BrowserEngine,
    config: HunterConfig,
    resume_text: str | None = None,
    dry_run: bool = False,
) -> bool:
    """Handle non-Easy Apply jobs by detecting external application platforms.

    When a job doesn't have Easy Apply, LinkedIn shows a regular "Apply" button
    that opens the company's career site in a new tab. This function:
    1. Clicks the external Apply button
    2. Detects the new tab URL
    3. Routes to the appropriate handler (Workday, etc.)
    4. Closes the external tab and returns to LinkedIn
    """
    from linkedin_hunter.workday.detector import detect_current_page, detect_workday_fields
    from linkedin_hunter.workday.filler import fill_workday_fields
    from linkedin_hunter.workday.apply import (
        _click_apply_button, _check_login_required, _process_workday_wizard,
    )

    # Find the external "Apply" button (not Easy Apply)
    external_btn = await _find_external_apply_button(page)
    if not external_btn:
        console.print("  [dim]No Apply button found (Easy Apply or external)[/dim]")
        return False

    # Listen for new page (tab) opening
    context = engine.context
    new_page = None

    async def _on_page(p):
        nonlocal new_page
        new_page = p

    context.on("page", _on_page)

    try:
        # Click the external Apply button
        await external_btn.click()
        console.print("  [cyan]Clicked external Apply button...[/cyan]")

        # Wait for the new tab to open (up to 10s)
        for _ in range(20):
            if new_page is not None:
                break
            await asyncio.sleep(0.5)

        if new_page is None:
            # No new tab — might have navigated in the same tab
            # Check current URL
            await asyncio.sleep(2)
            current_url = page.url
            if is_workday_url(current_url):
                console.print(f"  [bold cyan]Detected Workday![/bold cyan] Switching to Workday handler")
                return await _handle_workday_application(page, config, resume_text, dry_run)
            console.print("  [yellow]External site opened but no new tab detected[/yellow]")
            return False

        # New tab opened — check its URL
        await new_page.wait_for_load_state("domcontentloaded")
        external_url = new_page.url
        log.info("External apply URL: %s", external_url)

        if is_workday_url(external_url):
            console.print(f"  [bold cyan]Detected Workday![/bold cyan] Handling automatically")
            result = await _handle_workday_application(new_page, config, resume_text, dry_run)
            # Close the external tab and return to LinkedIn
            try:
                await new_page.close()
            except Exception:
                pass
            return result
        else:
            # Unknown external platform — log and skip
            console.print(f"  [yellow]External site (not Workday): {external_url[:80]}[/yellow]")
            console.print("  [dim]Skipping — only Workday external sites are supported for now[/dim]")
            try:
                await new_page.close()
            except Exception:
                pass
            return False

    except Exception as e:
        log.warning("Error during external apply: %s", e)
        if new_page:
            try:
                await new_page.close()
            except Exception:
                pass
        return False
    finally:
        # Remove the event listener
        try:
            context.remove_listener("page", _on_page)
        except Exception:
            pass


async def _find_external_apply_button(page) -> object | None:
    """Find the external Apply button in the LinkedIn job detail pane.

    This is the regular "Apply" button (not Easy Apply) that opens an
    external career site in a new tab.
    """
    # LinkedIn external apply button selectors
    external_selectors = [
        # The main Apply button (external redirect)
        "button.jobs-apply-button",
        "a.jobs-apply-button",
        # Apply button with specific attributes
        "a[data-control-name='jobdetails_topcard_inapply']",
        "a[data-tracking-control-name='public_jobs_apply-link-offsite_sign-up-modal']",
        # Generic apply links in the job detail pane
        "a[href*='apply']",
    ]

    for selector in external_selectors:
        try:
            btn = await page.query_selector(selector)
            if btn and await btn.is_visible():
                text = ((await btn.text_content()) or "").strip().lower()
                # Make sure it says "Apply" but NOT "Easy Apply"
                if "apply" in text and "easy" not in text:
                    return btn
                # Also accept buttons that just say "Apply" even if we couldn't read text
                aria = ((await btn.get_attribute("aria-label")) or "").lower()
                if "apply" in aria and "easy" not in aria:
                    return btn
        except Exception:
            continue

    # Fallback: look for any visible link/button with "Apply" text in the job detail
    try:
        all_btns = await page.query_selector_all(
            "div.job-details-jobs-unified-top-card__container a, "
            "div.job-details-jobs-unified-top-card__container button, "
            "div.jobs-unified-top-card a, "
            "div.jobs-unified-top-card button"
        )
        for btn in all_btns:
            text = ((await btn.text_content()) or "").strip().lower()
            if text == "apply" or (text.startswith("apply") and "easy" not in text):
                return btn
    except Exception:
        pass

    return None


async def _handle_workday_application(
    page,
    config: HunterConfig,
    resume_text: str | None = None,
    dry_run: bool = False,
) -> bool:
    """Handle a Workday application that was opened from LinkedIn.

    The page is already on the Workday career site.
    We may need to click Apply again on the Workday job page,
    then process the multi-page wizard.
    """
    from linkedin_hunter.workday.apply import (
        _click_apply_button, _check_login_required, _process_workday_wizard,
    )

    await asyncio.sleep(random.uniform(2, 4))

    # Check if we're on the Workday job description page (need to click Apply)
    # or already in the application form
    apply_btn_found = await _click_apply_button(page)
    if apply_btn_found:
        await asyncio.sleep(random.uniform(2, 4))

    # Check if login is required
    if await _check_login_required(page):
        console.print("  [yellow]Workday login required — waiting 60s for manual login...[/yellow]")
        for _ in range(60):
            if is_shutting_down():
                return False
            await asyncio.sleep(1)
            if not await _check_login_required(page):
                console.print("  [green]Login detected![/green]")
                await asyncio.sleep(2)
                break
        else:
            console.print("  [red]Login timeout[/red]")
            return False

    # Process the multi-page wizard
    return await _process_workday_wizard(page, config, resume_text, dry_run)


async def _process_application_modal(
    page,
    config: HunterConfig,
    dry_run: bool = False,
    resume_text: str | None = None,
) -> bool:
    """Walk through a multi-step Easy Apply modal.

    Returns True if the application was submitted (or would be in dry-run mode).
    """
    prev_error_count = 0
    stuck_count = 0

    # Scrape applicant profile info visible in the modal header
    await _scrape_modal_profile(page, config)

    for step in range(MAX_FORM_STEPS):
        log.info("Processing form step %d", step + 1)

        # Wait for modal content to settle
        await asyncio.sleep(1.5)

        # Check if modal is still open
        modal = await page.query_selector(APPLY_SELECTORS["modal"])
        if not modal:
            log.info("Modal closed (possibly submitted)")
            return step > 0  # At least one step processed

        # Detect and fill form fields
        fields = await detect_form_fields(page)
        if fields:
            filled, skipped, req_failed = await fill_form_fields(page, fields, config, resume_text=resume_text)
            log.info("Step %d: filled=%d, skipped=%d, req_failed=%s", step + 1, filled, skipped, req_failed)
            if req_failed:
                log.warning("Step %d has unfulfilled required fields — abandoning application safely", step + 1)
                console.print("  [yellow]Skipping application: required question was unanswered[/yellow]")
                await _dismiss_modal(page)
                return False

        # Uncheck "Follow company" if configured
        if not config.apply.follow_company:
            try:
                follow = await page.query_selector(APPLY_SELECTORS["follow_checkbox"])
                if follow:
                    checkbox = await page.query_selector("input#follow-company-checkbox")
                    if checkbox and await checkbox.is_checked():
                        await follow.click()
            except Exception:
                pass

        # Dismiss any typeahead/autocomplete dropdowns that overlay buttons
        await _dismiss_typeaheads(page)

        await short_delay()

        # Check for validation errors
        errors = await page.query_selector_all(APPLY_SELECTORS["error_message"])
        error_count = len(errors)
        if errors:
            error_texts = []
            for err in errors:
                text = await err.text_content()
                if text:
                    error_texts.append(text.strip())
            if error_texts:
                log.warning("Form errors at step %d: %s", step + 1, "; ".join(error_texts))

        # Stuck detection: if we see errors and they don't decrease, we're stuck
        if error_count > 0 and error_count >= prev_error_count:
            stuck_count += 1
        else:
            stuck_count = 0
        prev_error_count = error_count

        if stuck_count >= 2:
            log.warning("Stuck on form step with %d unresolvable errors, giving up", error_count)
            console.print(f"  [yellow]Stuck: can't fill required fields, skipping[/yellow]")
            await _dismiss_modal(page)
            return False

        # Determine what button to click next
        action = await _determine_next_action(page)

        if action == "submit":
            is_authorized = not dry_run and getattr(config.apply, "allow_live_submission", False)
            if not is_authorized:
                console.print("  [yellow]SAFETY GUARD: Submission blocked. Dry run or live submission unauthorized.[/yellow]")
                await _dismiss_modal(page)
                return True
            await _click_footer_primary(page)
            await asyncio.sleep(2)
            log.info("Submitted application")
            await _dismiss_modal(page)
            return True

        elif action == "next":
            await _click_footer_primary(page)
            await asyncio.sleep(1)
            continue

        else:
            log.warning("No actionable button found at step %d", step + 1)
            break

    # If we exhausted steps, dismiss and fail
    await _dismiss_modal(page)
    return False


async def _determine_next_action(page) -> str:
    """Determine what the next action should be based on modal footer buttons.

    Returns: 'submit', 'review', 'next', or 'none'
    """
    candidate_selectors = [
        "button[aria-label*='Submit' i]",
        "button:has-text('Submit application')",
        "button:has-text('Submit')",
        "button[aria-label*='Review' i]",
        "button:has-text('Review your application')",
        "button:has-text('Review')",
        "button[aria-label*='Next' i]",
        "button:has-text('Next')",
        "button[aria-label*='Continue' i]",
        "button:has-text('Continue')",
        "button.artdeco-button--primary",
        "footer button",
    ]
    for sel in candidate_selectors:
        try:
            btns = await page.query_selector_all(sel)
            for b in btns:
                if hasattr(b, "is_visible") and callable(b.is_visible):
                    v = b.is_visible()
                    if hasattr(v, "__await__"):
                        v = await v
                    if v is False:
                        continue
                raw_aria = await b.get_attribute("aria-label")
                if hasattr(raw_aria, "__await__"):
                    raw_aria = await raw_aria
                aria = str(raw_aria or "").strip().lower()

                raw_text = await b.text_content()
                if hasattr(raw_text, "__await__"):
                    raw_text = await raw_text
                text = str(raw_text or "").strip().lower()

                if "submit" in aria or "submit" in text:
                    return "submit"
                if "review" in aria or "review" in text:
                    return "review"
                if "next" in aria or "next" in text or "continue" in aria or "continue" in text:
                    return "next"
        except Exception:
            continue

    return "none"



async def _click_footer_primary(page) -> bool:
    """Click the primary button in the modal footer to advance to next step or review."""
    candidate_selectors = [
        "button:has-text('Next')",
        "button:has-text('Continue')",
        "button:has-text('Review')",
        "button:has-text('Review your application')",
        "button[aria-label*='Next' i]",
        "button[aria-label*='Continue' i]",
        "button[aria-label*='Review' i]",
        "button.artdeco-button--primary",
        APPLY_SELECTORS["next_button"],
        "footer button",
    ]
    for sel in candidate_selectors:
        try:
            btns = await page.query_selector_all(sel)
            for btn in btns:
                if not await btn.is_visible():
                    continue
                if await btn.is_disabled():
                    continue
                txt = ((await btn.text_content()) or "").strip().lower()
                aria = ((await btn.get_attribute("aria-label")) or "").strip().lower()
                if any(k in txt or k in aria for k in ["next", "continue", "review"]):
                    await btn.scroll_into_view_if_needed()
                    await asyncio.sleep(0.3)
                    await btn.click(force=True, timeout=5000)
                    return True
        except Exception:
            continue
    return False


async def _scrape_modal_profile(page, config: HunterConfig) -> None:
    """Scrape applicant's profile info visible in the Easy Apply modal header.

    The modal shows the user's name, headline, and location below their photo.
    This info can fill gaps in the config (city, name, etc.).
    """
    try:
        # The modal header typically has the applicant's profile card
        # with name, headline, and location
        modal = await page.query_selector(APPLY_SELECTORS["modal"])
        if not modal:
            return

        # Try to get the profile location (usually shown as "City, State" or "City, Country")
        location_el = await modal.query_selector(
            "span.jobs-easy-apply-modal__profile-location, "
            "span.t-14.t-black--light, "
            "div.jobs-easy-apply-content p.t-14"
        )
        if location_el:
            location_text = ((await location_el.text_content()) or "").strip()
            if location_text and not config.profile.city:
                # Parse "City, State" or "City, State, Country"
                parts = [p.strip() for p in location_text.split(",")]
                if parts:
                    config.profile.city = parts[0]
                    log.info("Scraped city from modal: %s", config.profile.city)
                if len(parts) >= 2:
                    config.profile.state = parts[1]
                    log.info("Scraped state from modal: %s", config.profile.state)

        # Try to get the profile name
        name_el = await modal.query_selector(
            "h3.jobs-easy-apply-modal__profile-name, "
            "span.t-16.t-bold, "
            "h3.t-16.t-bold"
        )
        if name_el:
            name_text = ((await name_el.text_content()) or "").strip()
            if name_text and not config.profile.first_name:
                name_parts = name_text.split()
                if name_parts:
                    config.profile.first_name = name_parts[0]
                    if len(name_parts) > 1:
                        config.profile.last_name = name_parts[-1]
                    log.info("Scraped name from modal: %s %s",
                             config.profile.first_name, config.profile.last_name)

    except Exception as e:
        log.debug("Could not scrape modal profile: %s", e)


async def _dismiss_typeaheads(page) -> None:
    """Close any open typeahead/autocomplete dropdowns that overlay buttons."""
    try:
        # Click on a neutral area of the modal to defocus inputs
        modal = await page.query_selector(APPLY_SELECTORS["modal"])
        if modal:
            header = await modal.query_selector("h2, h3, .t-24")
            if header:
                await header.click(force=True)
                await asyncio.sleep(0.2)
    except Exception:
        pass


async def _dismiss_modal(page, log_event_cb: Optional[Callable] = None) -> None:
    """Close any open modal dialogs and handle Save/Discard confirmation dialogs cleanly."""
    # 1. Look for application modal dismiss button (X)
    try:
        dismiss_selectors = [
            APPLY_SELECTORS["dismiss_button"],
            "button[aria-label='Dismiss']",
            "button.artdeco-modal__dismiss",
            "button[data-test-modal-close-btn]",
            "button[aria-label='Close']",
        ]
        for selector in dismiss_selectors:
            dismiss_btns = await page.query_selector_all(selector)
            for d_btn in dismiss_btns:
                if await d_btn.is_visible():
                    await d_btn.click()
                    await asyncio.sleep(0.8)
                    break
    except Exception:
        pass

    # 2. Handle "Save this application?" / "Discard application" confirmation dialog
    try:
        dialog_el = await page.query_selector(
            "div[data-test-modal-id='save-application-modal'], div.artdeco-modal[role='alertdialog'], div[role='alertdialog'], div[role='dialog']"
        )
        if dialog_el:
            # Check if this dialog contains Save/Discard prompt
            raw_text = await dialog_el.text_content()
            dialog_text = raw_text.lower() if isinstance(raw_text, str) else ""
            if "save" in dialog_text or "discard" in dialog_text or "return to this application" in dialog_text:
                if log_event_cb:
                    log_event_cb("SAVE_EXIT_DIALOG_DETECTED", "Detected LinkedIn Save/Discard confirmation dialog. Clicking Discard.", "info")
                
                discard_selectors = [
                    "button[data-control-name='discard_application_confirm_btn']",
                    "button.artdeco-modal__confirm-dialog-btn",
                    "button[data-test-dialog-secondary-btn]",
                    "button:has-text('Discard')",
                ]
                for sel in discard_selectors:
                    discard_btn = await page.query_selector(sel)
                    if discard_btn and await discard_btn.is_visible():
                        await discard_btn.click()
                        await asyncio.sleep(0.5)
                        if log_event_cb:
                            log_event_cb("APPLICATION_DISCARD_CONFIRMED", "Clicked Discard on application exit confirmation.", "info")
                        break
    except Exception as e:
        log.debug("Error handling discard confirmation dialog: %s", e)


async def submit_final_application(page) -> bool:
    """Submit the final application to LinkedIn.
    
    CRITICAL: This function must ONLY be called when is_real_submission_authorized is True.
    """
    candidate_selectors = [
        "button[aria-label*='Submit' i]",
        "button:has-text('Submit application')",
        "button:has-text('Submit')",
        "div.jobs-easy-apply-modal footer button.artdeco-button--primary",
        "div.jobs-easy-apply-content footer button.artdeco-button--primary",
        "div[role='dialog'] footer button.artdeco-button--primary",
        "button.artdeco-button--primary",
        "footer button",
    ]
    for sel in candidate_selectors:
        try:
            btns = await page.query_selector_all(sel)
            for btn in btns:
                if not await btn.is_visible():
                    continue
                if await btn.is_disabled():
                    continue
                txt = ((await btn.text_content()) or "").strip().lower()
                aria = ((await btn.get_attribute("aria-label")) or "").strip().lower()
                if "submit" in txt or "submit" in aria or ("primary" in sel and "cancel" not in txt and "dismiss" not in txt and "back" not in txt):
                    await btn.scroll_into_view_if_needed()
                    await asyncio.sleep(0.3)
                    await btn.click(force=True, timeout=5000)
                    await asyncio.sleep(2)
                    return True
        except Exception:
            continue
    return False


async def verify_post_submit_status(page, timeout_sec: float = 15.0) -> dict:
    """Verify application submission result on LinkedIn after clicking final Submit.
    
    Returns a structured dict:
    {
        "status": "confirmed" | "failed" | "ambiguous",
        "error_message": Optional[str],
        "details": str,
        "captcha_detected": bool,
        "checkpoint_detected": bool,
    }
    """
    result = {
        "status": "ambiguous",
        "error_message": None,
        "details": "Post-submission verification initiated",
        "captcha_detected": False,
        "checkpoint_detected": False,
    }

    start_time = asyncio.get_event_loop().time()
    while (asyncio.get_event_loop().time() - start_time) < timeout_sec:
        current_url = page.url or ""

        # 1. Check for security checkpoint / challenge / login redirect
        if any(x in current_url for x in ["/checkpoint", "/challenge", "/security-check"]):
            result["status"] = "failed"
            result["checkpoint_detected"] = True
            result["error_message"] = f"LinkedIn security checkpoint detected at {current_url}"
            result["details"] = "Security checkpoint / challenge triggered upon submission."
            return result

        if any(x in current_url for x in ["/login", "/authwall", "/uas/login"]):
            result["status"] = "failed"
            result["error_message"] = "Redirected to login/authwall upon submission"
            result["details"] = "Authentication session expired or login challenge triggered."
            return result

        # Check for CAPTCHA iframes/elements
        try:
            captcha_el = await page.query_selector("iframe[src*='arkose'], iframe[src*='recaptcha'], div#captcha-internal, div.captcha")
            if captcha_el:
                result["status"] = "failed"
                result["captcha_detected"] = True
                result["error_message"] = "CAPTCHA verification challenge detected"
                result["details"] = "Submission halted due to CAPTCHA."
                return result
        except Exception:
            pass

        # 2. Check for form validation error in modal
        try:
            error_els = await page.query_selector_all(
                "div.artdeco-inline-feedback--error, span.artdeco-inline-feedback__message, div[role='alert'], p.artdeco-inline-feedback__message"
            )
            for err in error_els:
                if await err.is_visible():
                    err_text = ((await err.text_content()) or "").strip()
                    if err_text:
                        result["status"] = "failed"
                        result["error_message"] = f"LinkedIn submission rejected: {err_text}"
                        result["details"] = f"Validation error on final submission step: {err_text}"
                        return result
        except Exception:
            pass

        # 3. Check for Post-Apply Success confirmation dialog/toast/heading
        success_selectors = [
            "div.jobs-post-apply-modal",
            "div.artdeco-modal[role='dialog']:has-text('Application sent')",
            "div.artdeco-modal[role='dialog']:has-text('Your application was sent')",
            "div.artdeco-modal:has-text('Application submitted')",
            "div.artdeco-modal:has-text('Your application has been submitted')",
            "div[data-test-modal-id='post-apply-modal']",
            "h2:has-text('Application sent')",
            "h3:has-text('Application sent')",
            "h2:has-text('Your application was sent')",
            "h2:has-text('Application submitted')",
            "span.jobs-details__applied-text",
            "div.artdeco-inline-feedback--success",
            "span.artdeco-inline-feedback__message:has-text('Applied')",
        ]
        for s_sel in success_selectors:
            try:
                s_el = await page.query_selector(s_sel)
                if s_el and await s_el.is_visible():
                    post_dismiss = await page.query_selector(
                        "div.jobs-post-apply-modal button[aria-label='Dismiss'], div.jobs-post-apply-modal button:has-text('Done'), button.artdeco-modal__dismiss"
                    )
                    if post_dismiss:
                        try:
                            await post_dismiss.click()
                        except Exception:
                            pass
                    result["status"] = "confirmed"
                    result["details"] = "Application successfully submitted and confirmed by LinkedIn."
                    result["error_message"] = None
                    return result
            except Exception:
                continue

        # 4. Check for 'Applied' status badge on the job details view
        try:
            applied_badge = await page.query_selector(
                "span.artdeco-inline-feedback__message:has-text('Applied'), span.jobs-details__applied-text, div.jobs-s-apply span:has-text('Applied'), div.jobs-unified-top-card span:has-text('Applied'), button:has-text('Applied')"
            )
            if applied_badge and await applied_badge.is_visible():
                result["status"] = "confirmed"
                result["details"] = "Applied status badge verified on job page."
                result["error_message"] = None
                return result
        except Exception:
            pass

        await asyncio.sleep(0.8)

    result["status"] = "ambiguous"
    result["error_message"] = "Post-submission state was not conclusively confirmed within timeout"
    result["details"] = "Submission was attempted, but confirmation indicators were not detected."
    return result


async def execute_single_job_playwright_apply(
    page,
    config: HunterConfig,
    job_url: str,
    job_id: str,
    job_title: str,
    dry_run: bool = True,
    allow_live_submission: bool = False,
    live_submission_confirmation: Optional[str] = None,
    resume_path: Optional[str] = None,
    log_event_cb: Optional[object] = None,
) -> dict:
    """Execute real Playwright Easy Apply flow for a single job with Triple-Key Safety Guard.

    Triple-Key Safety Guard (Three-Condition Live Submission Guard):
    - Real submission requires ALL THREE conditions:
      1. dry_run is False
      2. allow_live_submission is True
      3. live_submission_confirmation == "CONFIRM_REAL_SUBMISSION"
    - If ANY condition is missing or falsy, submission is blocked safely and dry-run telemetry is recorded.
    """
    def log_evt(event: str, message: str, level: str = "info", metadata: Optional[dict] = None):
        if log_event_cb and callable(log_event_cb):
            try:
                log_event_cb(event, message, level, metadata or {})
            except Exception as e:
                log.warning("Failed to invoke log_event_cb: %s", e)

    is_real_submission_authorized = bool(
        (dry_run is False)
        and (allow_live_submission is True)
        and (live_submission_confirmation == "CONFIRM_REAL_SUBMISSION")
    )

    telemetry = {
        "success": False,
        "dry_run": dry_run,
        "allow_live_submission": allow_live_submission,
        "job_id": job_id,
        "easy_apply_detected": False,
        "modal_opened": False,
        "steps_completed": 0,
        "fields_detected": 0,
        "fields_filled": 0,
        "questions_detected": 0,
        "questions_answered": 0,
        "resume_uploaded": False,
        "validation_errors": 0,
        "review_reached": False,
        "submission_attempted": False,
        "submission_confirmed": False,
        "submission_blocked": False,
        "error_message": None,
    }

    # 1. Open Job Page
    log_evt("JOB_PAGE_OPENED", f"Opening job page: {job_title}", "info", {"job_id": job_id, "url": job_url, "title": job_title})
    try:
        await page.goto(job_url, wait_until="domcontentloaded", timeout=25000)
        await asyncio.sleep(2)
    except Exception as e:
        log_evt("JOB_PAGE_ERROR", f"Failed to load job page: {str(e)}", "error", {"job_id": job_id, "error": str(e)})
        telemetry["error_message"] = f"Failed to load job page: {str(e)}"
        return telemetry

    # Check for security challenge / checkpoint / login redirect
    current_url = page.url or ""
    if any(x in current_url for x in ["/checkpoint", "/challenge", "/security-check"]):
        log_evt("SECURITY_CHALLENGE_DETECTED", "LinkedIn security verification / checkpoint detected. Halting automation.", "error", {"job_id": job_id, "url": current_url})
        telemetry["error_message"] = "Security challenge detected on job page"
        return telemetry

    if any(x in current_url for x in ["/login", "/authwall", "/uas/login"]):
        log_evt("AUTH_REQUIRED", "Redirected to login/authwall while accessing job page.", "error", {"job_id": job_id, "url": current_url})
        telemetry["error_message"] = "Authentication required on job page"
        return telemetry

    # 2. Check if already applied
    if await _is_already_applied_on_page(page):
        log_evt("JOB_SKIPPED", f"Job '{job_title}' is already applied on LinkedIn.", "warning", {"job_id": job_id, "reason": "already_applied"})
        telemetry["error_message"] = "Already applied on LinkedIn"
        telemetry["skipped"] = True
        return telemetry

    # 3. Detect and click Easy Apply button
    clicked = False
    for attempt in range(12):
        if await _click_easy_apply(page):
            clicked = True
            break
        await asyncio.sleep(1.0)

    if not clicked:
        log_evt("EASY_APPLY_NOT_AVAILABLE", f"Easy Apply is not available for '{job_title}'. Skipping.", "info", {"job_id": job_id, "url": job_url})
        telemetry["error_message"] = "Easy Apply button not available"
        telemetry["skipped"] = True
        return telemetry

    telemetry["easy_apply_detected"] = True
    log_evt("EASY_APPLY_DETECTED", f"Easy Apply detected for '{job_title}'.", "info", {"job_id": job_id})

    await asyncio.sleep(2.0)
    modal_opened = False
    for _ in range(12):
        check_el = await page.query_selector(
            "button:has-text('Next'), button:has-text('Review'), button:has-text('Submit application'), "
            "button[aria-label='Dismiss'], div[role='dialog'], div.jobs-easy-apply-modal, div.jobs-easy-apply-content, "
            "div.artdeco-modal, div#artdeco-modal-outlet div"
        )
        if check_el:
            is_v = True
            if hasattr(check_el, "is_visible") and callable(check_el.is_visible):
                r = check_el.is_visible()
                if hasattr(r, "__await__"):
                    r = await r
                if r is False:
                    is_v = False
            if is_v:
                modal_opened = True
                break
        await asyncio.sleep(0.5)

    if not modal_opened:
        log_evt("MODAL_OPEN_FAILED", "Easy Apply modal container did not appear.", "error", {"job_id": job_id})
        telemetry["error_message"] = "Easy Apply modal not detected"
        return telemetry

    telemetry["modal_opened"] = True
    log_evt("APPLICATION_MODAL_OPENED", "Easy Apply application modal opened.", "info", {"job_id": job_id})

    # Scrape applicant profile info visible in the modal header
    await _scrape_modal_profile(page, config)

    resume_text = extract_resume_text(Path(resume_path)) if (resume_path and Path(resume_path).exists()) else None

    prev_error_count = 0
    stuck_count = 0

    # 5. Multi-Step Form Handling
    for step in range(MAX_FORM_STEPS):
        log_evt("FORM_STEP_STARTED", f"Processing application form step {step + 1}", "info", {"step": step + 1, "job_id": job_id})

        await asyncio.sleep(1.5)

        # Detect fields
        fields = await detect_form_fields(page)
        telemetry["fields_detected"] += len(fields)

        step_fields_filled = 0
        step_questions_answered = 0

        for field in fields:
            # Handle File Upload (Resume)
            if field.field_type == FieldType.FILE_UPLOAD:
                if resume_path and Path(resume_path).exists():
                    log_evt("RESUME_UPLOAD_STARTED", "Uploading candidate resume.", "info", {"file": Path(resume_path).name})
                    try:
                        await field.element.set_input_files(str(resume_path))
                        telemetry["resume_uploaded"] = True
                        log_evt("RESUME_UPLOAD_COMPLETED", "Candidate resume uploaded successfully.", "info", {"file": Path(resume_path).name})
                        step_fields_filled += 1
                        telemetry["fields_filled"] += 1
                    except Exception as e:
                        log_evt("RESUME_UPLOAD_ERROR", f"Error uploading resume: {str(e)}", "warning", {"error": str(e)})
                else:
                    log_evt("RESUME_NOT_AVAILABLE", "No candidate resume file available on disk.", "warning", {"required": field.required})
                continue

            # Check if this is a question
            is_question = bool(
                field.field_type in [FieldType.RADIO, FieldType.SELECT, FieldType.CHECKBOX]
                or any(kw in field.label.lower() for kw in ["how many", "years", "experience", "authorized", "require", "sponsor", "willing", "salary", "ctc", "notice", "open to", "work from"])
            )

            if is_question:
                telemetry["questions_detected"] += 1
                log_evt("QUESTION_DETECTED", f"Question detected: {field.label[:60]}", "debug", {
                    "question": field.label[:80],
                    "type": field.field_type.value,
                    "required": field.required,
                })

            # Fill field
            try:
                filled = await _fill_field(page, field, config, resume_text=resume_text)
                if filled:
                    step_fields_filled += 1
                    telemetry["fields_filled"] += 1
                    log_evt("FIELD_FILLED", f"Filled form field: {field.label[:40]}", "debug", {
                        "field": field.label[:50],
                        "type": field.field_type.value,
                        "filled": True,
                    })
                    if is_question:
                        step_questions_answered += 1
                        telemetry["questions_answered"] += 1
                        log_evt("QUESTION_ANSWERED", f"Answered question: {field.label[:50]}", "debug", {
                            "question": field.label[:50],
                            "source": "profile/config",
                        })
                else:
                    if field.required:
                        if not is_question:
                            log_evt("PROFILE_DATA_MISSING", f"Required profile field missing: {field.label[:40]}", "warning", {
                                "field": field.label[:50],
                                "required": True,
                            })
                        else:
                            log_evt("QUESTION_UNRESOLVED", f"Required question could not be answered: {field.label[:40]}", "warning", {
                                "question": field.label[:50],
                                "required": True,
                            })
            except Exception as e:
                log.warning("Field filling error on '%s': %s", field.label, e)

        # Dismiss dropdowns
        await _dismiss_typeaheads(page)
        await short_delay()

        # Check validation errors
        errors = await page.query_selector_all(APPLY_SELECTORS["error_message"])
        error_count = len(errors)
        if error_count > 0:
            telemetry["validation_errors"] += error_count
            log_evt("FORM_VALIDATION_ERROR", f"Detected {error_count} validation error(s) in form step {step + 1}.", "warning", {
                "count": error_count,
                "step": step + 1,
            })

        if error_count > 0 and error_count >= prev_error_count:
            stuck_count += 1
        else:
            stuck_count = 0
        prev_error_count = error_count

        if stuck_count >= 2:
            log_evt("APPLICATION_FLOW_TIMEOUT", f"Form stuck at step {step + 1} with unresolvable errors. Closing modal safely.", "warning", {"step": step + 1})
            await _dismiss_modal(page, log_evt)
            telemetry["error_message"] = f"Form stuck at step {step + 1} with validation errors"
            return telemetry

        telemetry["steps_completed"] += 1
        log_evt("FORM_STEP_COMPLETED", f"Completed step {step + 1} (filled {step_fields_filled} fields).", "info", {
            "step": step + 1,
            "fields_filled": step_fields_filled,
            "questions_answered": step_questions_answered,
        })

        # Determine next action
        action = await _determine_next_action(page)
        
        if action == "review":
            telemetry["review_reached"] = True
            log_evt("APPLICATION_REVIEW_REACHED", "Reached the application review step.", "info", {"step": step + 1, "job_id": job_id})
            if not is_real_submission_authorized:
                # SAFETY STOP: Dry-run or unconfirmed real submission stops at Review
                telemetry["submission_blocked"] = True
                telemetry["submission_confirmed"] = False
                telemetry["success"] = True
                guard_reason = "dry_run=True" if dry_run else "allow_live_submission not confirmed"
                log_evt(
                    "DRY_RUN_SUBMIT_BLOCKED",
                    f"Final application submission blocked by safety guard ({guard_reason}). Modal reviewed successfully.",
                    "info",
                    {
                        "job_id": job_id,
                        "dry_run": dry_run,
                        "allow_live_submission": allow_live_submission,
                        "steps_completed": telemetry["steps_completed"],
                        "fields_detected": telemetry["fields_detected"],
                        "fields_filled": telemetry["fields_filled"],
                        "questions_detected": telemetry["questions_detected"],
                        "questions_answered": telemetry["questions_answered"],
                        "resume_uploaded": telemetry["resume_uploaded"],
                        "validation_errors": telemetry["validation_errors"],
                        "review_reached": True,
                        "submission_blocked": True,
                        "submission_confirmed": False,
                    },
                )
                await _dismiss_modal(page, log_evt)
                log_evt("APPLICATION_MODAL_DISCARDED", "Easy Apply modal discarded cleanly.", "info", {"job_id": job_id})
                log_evt("DRY_RUN_COMPLETED", "Dry run completed successfully with final submit blocked.", "info", {
                    "job_id": job_id,
                    "steps_completed": telemetry["steps_completed"],
                    "fields_filled": telemetry["fields_filled"],
                })
                return telemetry
            else:
                await _click_footer_primary(page)
                await asyncio.sleep(2.0)
                action = await _determine_next_action(page)

        # ── 6. FINAL SUBMISSION GUARD & VERIFICATION ─────────────────
        if action == "submit":
            if not is_real_submission_authorized:
                telemetry["submission_blocked"] = True
                telemetry["review_reached"] = True
                telemetry["submission_confirmed"] = False
                telemetry["success"] = True
                guard_reason = "dry_run=True" if dry_run else "allow_live_submission not confirmed"
                log_evt(
                    "DRY_RUN_SUBMIT_BLOCKED",
                    f"Final application submission blocked by safety guard ({guard_reason}). Modal reviewed successfully.",
                    "info",
                    {
                        "job_id": job_id,
                        "dry_run": dry_run,
                        "allow_live_submission": allow_live_submission,
                        "steps_completed": telemetry["steps_completed"],
                        "fields_detected": telemetry["fields_detected"],
                        "fields_filled": telemetry["fields_filled"],
                        "questions_detected": telemetry["questions_detected"],
                        "questions_answered": telemetry["questions_answered"],
                        "resume_uploaded": telemetry["resume_uploaded"],
                        "validation_errors": telemetry["validation_errors"],
                        "review_reached": True,
                        "submission_blocked": True,
                        "submission_confirmed": False,
                    },
                )
                await _dismiss_modal(page, log_evt)
                log_evt("APPLICATION_MODAL_DISCARDED", "Easy Apply modal discarded cleanly.", "info", {"job_id": job_id})
                log_evt("DRY_RUN_COMPLETED", "Dry run completed successfully with final submit blocked.", "info", {
                    "job_id": job_id,
                    "steps_completed": telemetry["steps_completed"],
                    "fields_filled": telemetry["fields_filled"],
                })
                return telemetry
            else:
                # REAL SUBMISSION PATH (Explicitly enabled with Triple-Key Safety confirmation)
                telemetry["submission_attempted"] = True
                log_evt("SUBMISSION_ATTEMPTED", f"Attempting final application submission for '{job_title}'.", "info", {
                    "job_id": job_id,
                    "dry_run": False,
                    "allow_live_submission": True,
                })

                await submit_final_application(page)
                verification = await verify_post_submit_status(page)

                if verification["status"] == "confirmed":
                    telemetry["submission_confirmed"] = True
                    telemetry["success"] = True
                    telemetry["submission_blocked"] = False
                    log_evt("SUBMISSION_CONFIRMED", "Application submission confirmed on LinkedIn.", "info", {
                        "job_id": job_id,
                        "details": verification["details"],
                    })
                    log_evt("APPLICATION_SUBMITTED", f"Application submitted for {job_title}.", "info", {
                        "job_id": job_id,
                        "confirmed": True,
                    })
                    return telemetry
                else:
                    telemetry["submission_confirmed"] = False
                    telemetry["success"] = False
                    telemetry["error_message"] = verification.get("error_message") or "Submission unconfirmed"
                    log_evt("SUBMISSION_FAILED", f"Submission verification failed: {telemetry['error_message']}", "error", {
                        "job_id": job_id,
                        "verification": verification,
                    })
                    await _dismiss_modal(page, log_evt)
                    return telemetry

        elif action == "next":
            await _click_footer_primary(page)
            await asyncio.sleep(1.5)
            continue
        else:
            if not is_real_submission_authorized and telemetry["review_reached"]:
                telemetry["submission_blocked"] = True
                telemetry["success"] = True
                telemetry["submission_confirmed"] = False
                log_evt(
                    "DRY_RUN_SUBMIT_BLOCKED",
                    "Final application submission blocked by safety guard. Modal reviewed successfully.",
                    "info",
                    {
                        "job_id": job_id,
                        "dry_run": dry_run,
                        "allow_live_submission": allow_live_submission,
                        "steps_completed": telemetry["steps_completed"],
                        "review_reached": True,
                        "submission_blocked": True,
                        "submission_confirmed": False,
                    },
                )
                await _dismiss_modal(page, log_evt)
                log_evt("APPLICATION_MODAL_DISCARDED", "Easy Apply modal discarded cleanly.", "info", {"job_id": job_id})
                log_evt("DRY_RUN_COMPLETED", "Dry run completed successfully with final submit blocked.", "info", {
                    "job_id": job_id,
                    "steps_completed": telemetry["steps_completed"],
                })
                return telemetry

            log_evt("NO_ACTION_BUTTON", f"No actionable button found at step {step + 1}. Closing modal.", "warning", {"step": step + 1})
            break

    # If steps exhausted
    await _dismiss_modal(page, log_evt)
    log_evt("APPLICATION_MODAL_DISCARDED", "Easy Apply modal dismissed.", "info", {"job_id": job_id})
    telemetry["success"] = telemetry["steps_completed"] > 0 and telemetry["submission_blocked"]
    return telemetry

