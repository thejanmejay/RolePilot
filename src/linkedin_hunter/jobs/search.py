"""Job search orchestration: navigate, paginate, collect results."""

from __future__ import annotations

import asyncio
import io
import sys

from rich.console import Console
from rich.table import Table

from linkedin_hunter.browser.engine import BrowserEngine
from linkedin_hunter.browser.humanize import human_delay, smooth_scroll, random_mouse_jiggle
from linkedin_hunter.auth.session import load_cookies, has_valid_session
from linkedin_hunter.config import HunterConfig, get_project_root
from linkedin_hunter.db.models import init_db
from linkedin_hunter.db.repository import JobRepository, ActivityRepository
from linkedin_hunter.jobs.filters import build_search_url
from linkedin_hunter.jobs.parser import parse_job_cards, JobCard
from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)
console = Console(file=io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace"))

JOBS_PER_PAGE = 25


class SearchNavigationError(Exception):
    """Raised when LinkedIn search navigation fails due to Chrome error, network error, or HTTP error."""
    pass


class SearchAuthError(Exception):
    """Raised when LinkedIn search redirects to login/authwall."""
    pass


class SearchCheckpointError(Exception):
    """Raised when LinkedIn search hits a security checkpoint or challenge."""
    pass


async def collect_search_jobs(
    page: Page,
    config: HunterConfig,
    target_count: int = 50,
) -> list[JobCard]:
    """Collect up to `target_count` unique JobCards using continuous container scrolling.

    Adapted for LinkedIn's new AI-powered search (/jobs/search-results/) and virtualized DOM.
    Instead of broken start=25 offset URLs, navigates to the search URL once and incrementally
    scrolls the left results container, deduplicating newly mounted cards by linkedin_id.
    """
    seen_ids: set[str] = set()
    unique_cards: list[JobCard] = []

    console.print(f"\n[bold]Search collection:[/bold]")
    console.print(f"  Target: {target_count} unique jobs")
    console.print(f"  Keywords: {config.search.keywords}")
    console.print(f"  Location: {config.search.location}\n")

    url = build_search_url(config.search)
    log.info("Fetching search URL: %s", url)

    response = None
    goto_exception = None
    try:
        response = await page.goto(url, wait_until="domcontentloaded", timeout=25000)
    except Exception as exc:
        goto_exception = exc
        log.error("Navigation exception during job search: %s", exc)

    final_url = page.url or ""
    try:
        final_title = await page.title()
    except Exception:
        final_title = ""

    resp_status = response.status if response else None

    # Explicit Navigation Diagnostics (never logging cookies/tokens/auth headers)
    diag = {
        "search_url": url,
        "final_url": final_url,
        "status_code": resp_status,
        "page_title": final_title,
        "exception": str(goto_exception) if goto_exception else None,
    }
    log.info("[SEARCH-DIAG] Navigation details: %s", diag)

    # 1. Chrome error page check (chrome-error://chromewebdata/, etc.)
    is_chrome_error = (
        "chrome-error://" in final_url
        or "chromewebdata" in final_url
        or (goto_exception and any(err in str(goto_exception) for err in ["net::ERR_", "ERR_TOO_MANY_REDIRECTS", "ERR_NAME_NOT_RESOLVED"]))
    )
    if is_chrome_error:
        err_code = "ERR_NAVIGATION_FAILED"
        if goto_exception and "net::" in str(goto_exception):
            err_code = str(goto_exception).split("net::")[-1].split(" ")[0].strip()
        else:
            try:
                err_code = await page.evaluate("() => document.getElementById('main-message')?.innerText?.replace(/\\s+/g, ' ') || document.title")
            except Exception:
                pass
        log.error("Job search navigation reached Chrome error page: url=%s, error=%s", final_url, err_code)
        # STOP IMMEDIATELY! Do NOT scroll!
        raise SearchNavigationError(f"LinkedIn search page failed to load ({err_code}) at {final_url}")

    # 2. Login redirect check
    if any(x in final_url for x in ["/login", "/authwall", "/uas/login", "/signup", "checkpoint/lg/login"]):
        log.warning("Job search redirected to login page: %s", final_url)
        raise SearchAuthError(f"LinkedIn search redirected to login/authwall: {final_url}")

    # 3. Security checkpoint check
    if any(x in final_url for x in ["/checkpoint", "/challenge", "/security-check"]):
        log.warning("Job search redirected to security checkpoint: %s", final_url)
        raise SearchCheckpointError(f"LinkedIn security checkpoint detected: {final_url}")

    # 4. HTTP response status error check (403, 429, 999, 500, etc.)
    if resp_status and resp_status in [403, 429, 999, 500, 502, 503]:
        log.error("Job search returned HTTP %d: title=%s", resp_status, final_title)
        raise SearchNavigationError(f"LinkedIn search returned HTTP {resp_status} ({final_title})")

    if goto_exception:
        raise SearchNavigationError(f"Failed to navigate to LinkedIn search: {goto_exception}")

    try:
        await page.wait_for_selector(
            "ul.scaffold-layout__list-container, div.scaffold-layout__list, div.jobs-search-no-results-banner, div.artdeco-empty-state",
            timeout=10000,
        )
    except Exception:
        log.warning("Job list container not found, waiting extra time...")
    await human_delay()

    # Check for genuine zero results banner on an authenticated search page
    has_zero_results_banner = False
    try:
        has_zero_results_banner = await page.evaluate("""() => {
            const text = document.body ? document.body.innerText : '';
            return /no matching jobs found|0 results|no results found/i.test(text) || !!document.querySelector('.jobs-search-no-results-banner, .artdeco-empty-state');
        }""")
    except Exception:
        pass

    if has_zero_results_banner:
        log.info("[SEARCH-DIAG] Genuine zero results confirmed by LinkedIn empty-state indicator.")
        return []


    # Diagnostic inspection of page and scrollable elements on initial load
    try:
        result_info = await page.evaluate("""() => ({
            bodyText: document.body.innerText.match(/\\d[\\d,]*\\s+results/i)?.[0] || null,
            cards: document.querySelectorAll('li[data-occludable-job-id], li.jobs-search-results__list-item').length,
            listItems: document.querySelectorAll('li').length,
            url: location.href
        })""")
        log.info("[SEARCH-DIAG] Result info: %s", result_info)
    except Exception as e:
        log.debug("[SEARCH-DIAG] Result info error: %s", e)

    try:
        scrollables = await page.evaluate("""() => {
            const els = [...document.querySelectorAll('*')];
            return els.map((el, i) => {
                const s = getComputedStyle(el);
                return {
                    i,
                    tag: el.tagName,
                    id: el.id,
                    cls: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
                    scrollTop: el.scrollTop,
                    scrollHeight: el.scrollHeight,
                    clientHeight: el.clientHeight,
                    overflowY: s.overflowY,
                    hasCards: !!el.querySelector('li[data-occludable-job-id], li.jobs-search-results__list-item')
                };
            }).filter(x => x.scrollHeight > x.clientHeight + 20 && ['auto', 'scroll'].includes(x.overflowY)).slice(0, 30);
        }""")
        log.info("[SEARCH-DIAG] Scrollable elements: %s", scrollables)
    except Exception as e:
        log.debug("[SEARCH-DIAG] Scrollables error: %s", e)

    # 1. Initial collection of currently mounted cards before scrolling
    initial_cards = await parse_job_cards(page)
    for card in initial_cards:
        if card.linkedin_id and card.linkedin_id not in seen_ids:
            seen_ids.add(card.linkedin_id)
            unique_cards.append(card)
            if len(unique_cards) >= target_count:
                break

    console.print(
        f"  Initial collection: +{len(unique_cards)} new jobs — "
        f"Collected: [bold]{len(unique_cards)}[/bold]/{target_count}"
    )
    log.info(
        "Initial collection: +%d new unique cards (total unique: %d/%d)",
        len(unique_cards),
        len(unique_cards),
        target_count,
    )

    max_scroll_cycles = 40
    bottom_stable_count = 0

    for cycle in range(max_scroll_cycles):
        if len(unique_cards) >= target_count:
            log.info("Reached target collection count of %d unique jobs", target_count)
            break

        # 2. Scroll the actual scrollable container down to trigger lazy loading
        scroll_diag = {}
        try:
            scroll_diag = await page.evaluate("""() => {
                const candidates = [
                    document.querySelector('div.jobs-search-results-list'),
                    document.querySelector('div.scaffold-layout__list'),
                    document.querySelector('div.scaffold-layout__list-detail-inner'),
                    document.querySelector('ul.scaffold-layout__list-container')?.parentElement,
                    document.querySelector('div.jobs-search__left-rail')
                ];
                for (const el of candidates) {
                    if (el && el.scrollHeight > el.clientHeight + 20) {
                        const before = el.scrollTop;
                        el.scrollTop += Math.max(el.clientHeight * 0.75, 400);
                        const atBottom = (el.scrollTop + el.clientHeight >= el.scrollHeight - 30);
                        return {
                            target: el.className || el.tagName,
                            scrollTopBefore: before,
                            scrollTopAfter: el.scrollTop,
                            scrollHeight: el.scrollHeight,
                            clientHeight: el.clientHeight,
                            atBottom: atBottom
                        };
                    }
                }
                const all = [...document.querySelectorAll('div, main, section, aside')];
                for (const el of all) {
                    const s = getComputedStyle(el);
                    if (['auto', 'scroll'].includes(s.overflowY) && el.scrollHeight > el.clientHeight + 20 && el.querySelector('li[data-occludable-job-id], li.jobs-search-results__list-item')) {
                        const before = el.scrollTop;
                        el.scrollTop += Math.max(el.clientHeight * 0.75, 400);
                        const atBottom = (el.scrollTop + el.clientHeight >= el.scrollHeight - 30);
                        return {
                            target: el.className || el.tagName,
                            scrollTopBefore: before,
                            scrollTopAfter: el.scrollTop,
                            scrollHeight: el.scrollHeight,
                            clientHeight: el.clientHeight,
                            atBottom: atBottom
                        };
                    }
                }
                const before = window.scrollY;
                window.scrollBy(0, 600);
                const atBottom = (window.scrollY + window.innerHeight >= document.body.scrollHeight - 30);
                return { target: 'WINDOW', scrollTopBefore: before, scrollTopAfter: window.scrollY, atBottom: atBottom };
            }""")
        except Exception as e:
            log.debug("[SCROLL-STEP] eval error: %s", e)

        await asyncio.sleep(1.2)
        await random_mouse_jiggle(page)

        # 3. Parse newly mounted cards in the DOM
        cards = await parse_job_cards(page)
        new_in_cycle = 0

        for card in cards:
            if not card.linkedin_id:
                continue
            if card.linkedin_id not in seen_ids:
                seen_ids.add(card.linkedin_id)
                unique_cards.append(card)
                new_in_cycle += 1
                if len(unique_cards) >= target_count:
                    break

        at_bottom = bool(scroll_diag.get("atBottom", False))
        if new_in_cycle > 0:
            bottom_stable_count = 0
            console.print(
                f"  Scroll step {cycle + 1}: +{new_in_cycle} new jobs — "
                f"Collected: [bold]{len(unique_cards)}[/bold]/{target_count}"
            )
        else:
            if at_bottom:
                bottom_stable_count += 1
            else:
                bottom_stable_count = 0

        log.info(
            "[SCROLL-STEP] cycle=%d scrollTop=%s scrollHeight=%s clientHeight=%s atBottom=%s newUnique=%d totalUnique=%d/%d bottomStableCount=%d",
            cycle + 1,
            scroll_diag.get("scrollTopAfter"),
            scroll_diag.get("scrollHeight"),
            scroll_diag.get("clientHeight"),
            at_bottom,
            new_in_cycle,
            len(unique_cards),
            target_count,
            bottom_stable_count,
        )

        if len(unique_cards) >= target_count:
            log.info("Reached target collection count of %d unique jobs", target_count)
            break

        # If at bottom without new cards, check for pagination / "Show more" buttons
        if bottom_stable_count >= 2:
            button_clicked = False
            for selector in [
                "button.infinite-scroller__show-more-button",
                "button[aria-label*='See more jobs']",
                "button[aria-label*='Show more']",
                "button.scaffold-layout__list-action",
                "button[aria-label='View next page']",
                "button[aria-label='Next']",
                "button.artdeco-pagination__button--next",
                "ul.artdeco-pagination__pages li.active + li button",
            ]:
                try:
                    btn = await page.query_selector(selector)
                    if btn and await btn.is_visible():
                        is_disabled = await btn.get_attribute("disabled")
                        aria_disabled = await btn.get_attribute("aria-disabled")
                        if not is_disabled and aria_disabled != "true":
                            await btn.click()
                            log.info("[PAGINATION] Clicked next/more button: %s", selector)
                            button_clicked = True
                            await asyncio.sleep(2.5)
                            bottom_stable_count = 0
                            break
                except Exception:
                    pass

            if not button_clicked and bottom_stable_count >= 4:
                log.info("Reached stable bottom (%d checks) with no next/more button found; ending collection", bottom_stable_count)
                break

    return unique_cards


async def run_search(
    config: HunterConfig,
    limit: int | None = None,
    cookies: Optional[list[dict]] = None,
) -> list[JobCard]:
    """Execute a job search, save results to DB, and display them."""
    active_cookies = cookies if cookies is not None else load_cookies()
    if not has_valid_session(active_cookies):
        console.print("[bold red]No valid session. Connect LinkedIn in RolePilot or run 'linkedin-hunter login' first.[/bold red]")
        return []

    if not active_cookies:
        return []

    target_count = limit or config.search.max_jobs or 50

    root = get_project_root()
    conn = init_db(str(root / "data" / "hunter.db"))
    job_repo = JobRepository(conn)
    act_repo = ActivityRepository(conn)

    engine = BrowserEngine(config)

    try:
        page = await engine.launch()
        await engine.load_cookies(active_cookies)

        all_cards = await collect_search_jobs(page, config, target_count=target_count)

        # Save to database
        new_count = 0
        for card in all_cards:
            existing = job_repo.get_job_by_linkedin_id(card.linkedin_id)
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
            if not existing:
                new_count += 1

        act_repo.log("search", f"keywords={config.search.keywords}, found={len(all_cards)}, new={new_count}")
        act_repo.bump_daily_stat("searches")

        # Display results table
        _display_results(all_cards)
        console.print(f"\n[bold green]Found {len(all_cards)} unique jobs ({new_count} new)[/bold green]")

    except Exception as e:
        console.print(f"[bold red]Search error: {e}[/bold red]")
        log.exception("Search failed")
        all_cards = []

    finally:
        await engine.close()
        conn.close()

    return all_cards


def _display_results(cards: list[JobCard]) -> None:
    """Print a rich table of job results."""
    if not cards:
        console.print("[yellow]No jobs found.[/yellow]")
        return

    table = Table(title="Search Results", show_lines=False)
    table.add_column("#", style="dim", width=4)
    table.add_column("Title", style="bold", max_width=40)
    table.add_column("Company", style="green", max_width=25)
    table.add_column("Location", max_width=20)
    table.add_column("Easy Apply", justify="center")
    table.add_column("Posted", style="dim")

    for i, card in enumerate(cards, 1):
        ea = "[green]✓[/green]" if card.easy_apply else "[dim]—[/dim]"
        table.add_row(
            str(i),
            card.title,
            card.company,
            card.location,
            ea,
            card.posted_date[:10] if card.posted_date else "",
        )

    console.print(table)
