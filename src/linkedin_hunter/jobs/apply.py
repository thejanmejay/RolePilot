"""Easy Apply bot: multi-step modal form handling."""

from __future__ import annotations

import asyncio
import random
import re

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn

from linkedin_hunter.auth.session import load_cookies, has_valid_session
from linkedin_hunter.browser.engine import BrowserEngine
from linkedin_hunter.browser.humanize import human_delay, short_delay, smooth_scroll, random_mouse_jiggle
from linkedin_hunter.config import HunterConfig, get_project_root
from linkedin_hunter.db.models import init_db
from linkedin_hunter.db.repository import JobRepository, ActivityRepository
from linkedin_hunter.forms.detector import detect_form_fields
from linkedin_hunter.forms.filler import fill_form_fields
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
    "modal": "div.jobs-easy-apply-modal, div.jobs-easy-apply-content, div[data-test-modal-id='easy-apply-modal']",
    # Navigation buttons inside the modal footer
    "next_button": "div.jobs-easy-apply-modal footer button.artdeco-button--primary, div.jobs-easy-apply-content footer button.artdeco-button--primary",
    "dismiss_button": "button[aria-label='Dismiss'], button.artdeco-modal__dismiss",
    "error_message": "div.artdeco-inline-feedback--error",
    "follow_checkbox": "label[for='follow-company-checkbox']",
    # Job card in the left-pane list
    "job_card_link": "a.job-card-list__title--link, a.job-card-container__link",
}

MAX_FORM_STEPS = 10  # Safety limit on modal steps


async def run_apply(config: HunterConfig, limit: int = 15, dry_run: bool = False) -> None:
    """Main apply flow: search for Easy Apply jobs and apply to them.

    Uses the two-pane search results view: click job cards in left list,
    then click Easy Apply in the right detail pane.
    """
    # Install signal handlers for graceful shutdown
    reset_shutdown()
    install_signal_handlers()

    if not has_valid_session():
        console.print("[bold red]No valid session. Run 'linkedin-hunter login' first.[/bold red]")
        return

    cookies = load_cookies()
    if not cookies:
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
        await engine.load_cookies(cookies)

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
    """Find and click the Easy Apply button in the job detail pane."""
    try:
        btn = await page.wait_for_selector(
            APPLY_SELECTORS["easy_apply_button"],
            state="visible",
            timeout=10000,
        )
        if btn:
            # Verify it's actually an Easy Apply button (not a filter button)
            aria = (await btn.get_attribute("aria-label")) or ""
            text = ((await btn.text_content()) or "").strip().lower()
            if "easy apply" in aria.lower() or "easy apply" in text:
                await btn.click()
                await asyncio.sleep(1.5)
                return True

            # If first match wasn't right, try all matches
            all_btns = await page.query_selector_all(APPLY_SELECTORS["easy_apply_button"])
            for b in all_btns:
                a = (await b.get_attribute("aria-label")) or ""
                if "easy apply" in a.lower():
                    await b.click()
                    await asyncio.sleep(1.5)
                    return True
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
            if dry_run:
                console.print("  [yellow]DRY RUN: Would submit here[/yellow]")
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

    Returns: 'submit', 'next', or 'none'
    """
    # Look for the primary button in the modal footer
    footer_btn = await page.query_selector(APPLY_SELECTORS["next_button"])
    if not footer_btn:
        return "none"

    # Check aria-label and text to determine if this is submit or next
    aria = ((await footer_btn.get_attribute("aria-label")) or "").lower()
    text = ((await footer_btn.text_content()) or "").strip().lower()

    if "submit" in aria or "submit" in text:
        return "submit"
    if "review" in aria or "review" in text:
        return "next"  # Review is just a pre-submit step
    if "next" in aria or "next" in text or "continue" in aria or "continue" in text:
        return "next"

    # Default: treat as next
    return "next"


async def _click_footer_primary(page) -> None:
    """Click the primary button in the modal footer."""
    btn = await page.query_selector(APPLY_SELECTORS["next_button"])
    if btn:
        # Use force=True to bypass overlay interception (e.g., typeahead dropdowns)
        try:
            await btn.click(timeout=5000)
        except Exception:
            await btn.click(force=True, timeout=5000)


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
        # Press Escape to close any open dropdowns
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.3)
        # Click on a neutral area of the modal to defocus inputs
        modal = await page.query_selector(APPLY_SELECTORS["modal"])
        if modal:
            # Click on the modal header area (safe, non-interactive)
            header = await modal.query_selector("h2, h3, .t-24")
            if header:
                await header.click(force=True)
                await asyncio.sleep(0.2)
    except Exception:
        pass


async def _dismiss_modal(page) -> None:
    """Close any open modal dialogs."""
    for selector in [APPLY_SELECTORS["dismiss_button"]]:
        try:
            btn = await page.query_selector(selector)
            if btn:
                await btn.click()
                await asyncio.sleep(0.5)
        except Exception:
            pass

    # Handle "Discard application" / "Save this application?" confirmation dialogs
    try:
        # Try multiple selectors for the discard/dismiss button in confirmation dialogs
        discard_selectors = [
            "button[data-control-name='discard_application_confirm_btn']",
            "button.artdeco-modal__confirm-dialog-btn",
            # "Save this application?" dialog — click Discard
            "button[data-test-dialog-secondary-btn]",
        ]
        for sel in discard_selectors:
            btn = await page.query_selector(sel)
            if btn:
                await btn.click()
                await asyncio.sleep(0.5)
                break

        # Fallback: look for any button with "Discard" text in a dialog
        if not btn:
            all_btns = await page.query_selector_all("div.artdeco-modal button, div[role='dialog'] button, div[role='alertdialog'] button")
            for b in all_btns:
                text = ((await b.text_content()) or "").strip().lower()
                if "discard" in text:
                    await b.click()
                    await asyncio.sleep(0.5)
                    log.info("Clicked 'Discard' in confirmation dialog")
                    break
    except Exception:
        pass
