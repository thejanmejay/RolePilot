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


async def run_search(config: HunterConfig, limit: int = 50) -> list[JobCard]:
    """Execute a job search, save results to DB, and display them."""
    if not has_valid_session():
        console.print("[bold red]No valid session. Run 'linkedin-hunter login' first.[/bold red]")
        return []

    cookies = load_cookies()
    if not cookies:
        return []

    root = get_project_root()
    conn = init_db(str(root / "data" / "hunter.db"))
    job_repo = JobRepository(conn)
    act_repo = ActivityRepository(conn)

    all_cards: list[JobCard] = []
    engine = BrowserEngine(config)

    try:
        page = await engine.launch()
        await engine.load_cookies(cookies)

        pages_needed = (limit + JOBS_PER_PAGE - 1) // JOBS_PER_PAGE
        console.print(f"\n[bold]Searching:[/bold] {config.search.keywords}")
        console.print(f"[bold]Location:[/bold] {config.search.location}")
        console.print(f"[bold]Fetching up to:[/bold] {limit} jobs ({pages_needed} pages)\n")

        for page_num in range(pages_needed):
            start = page_num * JOBS_PER_PAGE
            url = build_search_url(config.search, start=start)
            log.info("Fetching page %d: %s", page_num + 1, url)

            await page.goto(url, wait_until="domcontentloaded")
            await human_delay()

            # Scroll down to load lazy content
            for _ in range(3):
                await smooth_scroll(page, "down", 400)
                await asyncio.sleep(0.5)

            await random_mouse_jiggle(page)

            cards = await parse_job_cards(page)
            if not cards:
                log.info("No more results on page %d, stopping", page_num + 1)
                break

            all_cards.extend(cards)
            console.print(f"  Page {page_num + 1}: found {len(cards)} jobs")

            if len(all_cards) >= limit:
                all_cards = all_cards[:limit]
                break

            if page_num < pages_needed - 1:
                await human_delay()

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
        console.print(f"\n[bold green]Found {len(all_cards)} jobs ({new_count} new)[/bold green]")

    except Exception as e:
        console.print(f"[bold red]Search error: {e}[/bold red]")
        log.exception("Search failed")

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
