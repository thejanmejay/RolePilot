"""Click CLI commands for linkedin-hunter."""

from __future__ import annotations

import io
import re
import shutil
import sys
from pathlib import Path

import click
from rich.console import Console
from rich.table import Table

from linkedin_hunter.config import HunterConfig, load_config, get_project_root
from linkedin_hunter.db.models import init_db
from linkedin_hunter.utils.logging import setup_logging, get_logger

console = Console(file=io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace"))
pass_config = click.make_pass_decorator(HunterConfig, ensure=True)


@click.group()
@click.option("--config", "config_path", default=None, help="Path to config.yaml")
@click.pass_context
def cli(ctx: click.Context, config_path: str | None) -> None:
    """LinkedIn Hunter - Automated job search & Easy Apply CLI."""
    ctx.ensure_object(dict)
    cfg = load_config(config_path)
    ctx.obj["config"] = cfg
    setup_logging(cfg.logging.level, cfg.logging.log_file)


# ── init ─────────────────────────────────────────────────────────────
@cli.command()
@click.pass_context
def init(ctx: click.Context) -> None:
    """Initialize project: create dirs, example config, and database."""
    root = get_project_root()
    log = get_logger()

    # Create directories
    for d in ["data/logs", "resumes"]:
        (root / d).mkdir(parents=True, exist_ok=True)
        console.print(f"  [green]✓[/green] Created {d}/")

    # Copy example config if config.yaml doesn't exist
    example = root / "config.example.yaml"
    target = root / "config.yaml"
    if not target.exists() and example.exists():
        shutil.copy(example, target)
        console.print("  [green]✓[/green] Created config.yaml from example")
    elif target.exists():
        console.print("  [yellow]⊘[/yellow] config.yaml already exists, skipping")

    # Init database
    conn = init_db(str(root / "data" / "hunter.db"))
    conn.close()
    console.print("  [green]✓[/green] Initialized database at data/hunter.db")

    log.info("Project initialized")
    console.print("\n[bold green]Initialization complete![/bold green]")
    console.print("Next steps:")
    console.print("  1. Edit [cyan]config.yaml[/cyan] with your profile info")
    console.print("  2. Place your resume in [cyan]resumes/[/cyan]")
    console.print("  3. Run [cyan]linkedin-hunter login[/cyan]")


# ── config ───────────────────────────────────────────────────────────
@cli.command("config")
@click.pass_context
def show_config(ctx: click.Context) -> None:
    """Display the currently loaded configuration."""
    cfg: HunterConfig = ctx.obj["config"]

    table = Table(title="Current Configuration", show_lines=True)
    table.add_column("Section", style="cyan")
    table.add_column("Key", style="green")
    table.add_column("Value")

    for section_name, section in [
        ("profile", cfg.profile),
        ("search", cfg.search),
        ("apply", cfg.apply),
        ("answers", cfg.answers),
        ("browser", cfg.browser),
        ("logging", cfg.logging),
    ]:
        for key, value in section.model_dump().items():
            display = str(value)
            if len(display) > 60:
                display = display[:57] + "..."
            table.add_row(section_name, key, display)

    console.print(table)


# ── setup ────────────────────────────────────────────────────────────
@cli.command()
@click.pass_context
def setup(ctx: click.Context) -> None:
    """Interactive setup: answer common Easy Apply questions and save to config."""
    import yaml

    root = get_project_root()
    config_path = root / "config.yaml"

    # Load existing config
    if config_path.exists():
        with open(config_path) as f:
            raw = yaml.safe_load(f) or {}
    else:
        raw = {}

    profile = raw.setdefault("profile", {})
    answers = raw.setdefault("answers", {})
    custom = answers.get("custom", [])

    console.print("\n[bold]LinkedIn Hunter - Interactive Setup[/bold]\n")

    # ── Check essential contact info first ─────────────────────────────
    email = profile.get("email", "")
    phone = profile.get("phone", "")
    has_email = bool(email) and email != "jane.doe@example.com"
    has_phone = bool(phone) and phone != "+1-555-123-4567"

    if not has_email:
        console.print("[yellow]No email found in config.[/yellow]")
        profile["email"] = click.prompt("Enter your email address")
    if not has_phone:
        console.print("[yellow]No phone number found in config.[/yellow]")
        profile["phone"] = click.prompt("Enter your phone number")

    # ── Show existing config ───────────────────────────────────────────
    _show_existing_config(profile, answers, custom)

    # ── Ask what to do ─────────────────────────────────────────────────
    action = click.prompt(
        "\nWhat would you like to do?",
        type=click.Choice(["keep", "update", "update-all"], case_sensitive=False),
        default="keep",
        show_choices=True,
    )

    if action == "keep":
        console.print("\n[green]Keeping existing configuration.[/green]")
    elif action == "update":
        _update_selected_sections(profile, answers, custom)
    elif action == "update-all":
        _update_all_sections(profile, answers, custom)

    answers["custom"] = custom
    raw["answers"] = answers
    raw["profile"] = profile

    # Save
    with open(config_path, "w") as f:
        yaml.dump(raw, f, default_flow_style=False, sort_keys=False)

    console.print(f"\n[bold green]Setup complete![/bold green] Config saved to {config_path}")
    console.print("Run [cyan]linkedin-hunter config[/cyan] to review your settings.")


def _show_existing_config(profile: dict, answers: dict, custom: list) -> None:
    """Display current configuration to the user."""
    table = Table(title="Current Profile Info", show_lines=True)
    table.add_column("Field", style="cyan")
    table.add_column("Value", style="green")

    profile_fields = [
        ("First Name", "first_name"),
        ("Last Name", "last_name"),
        ("Email", "email"),
        ("Phone", "phone"),
        ("City", "city"),
        ("State", "state"),
        ("Country", "country"),
        ("LinkedIn URL", "linkedin_url"),
        ("Website", "website"),
        ("Years of Experience", "years_of_experience"),
        ("Resume Path", "resume_path"),
    ]
    for label, key in profile_fields:
        val = str(profile.get(key, ""))
        table.add_row(label, val if val else "[dim]not set[/dim]")
    console.print(table)

    table2 = Table(title="Application Answers", show_lines=True)
    table2.add_column("Question", style="cyan")
    table2.add_column("Answer", style="green")
    answer_fields = [
        ("Authorized to work in US", "authorized_to_work"),
        ("Sponsorship required", "sponsorship_required"),
        ("Willing to relocate", "willing_to_relocate"),
        ("Desired salary", "desired_salary"),
        ("How did you hear", "how_did_you_hear"),
        ("Cover letter", "cover_letter"),
    ]
    for label, key in answer_fields:
        val = str(answers.get(key, ""))
        if len(val) > 60:
            val = val[:57] + "..."
        table2.add_row(label, val if val else "[dim]not set[/dim]")
    console.print(table2)

    if custom:
        table3 = Table(title="Custom Question Patterns", show_lines=True)
        table3.add_column("Pattern", style="cyan")
        table3.add_column("Answer", style="green")
        for entry in custom:
            table3.add_row(entry.get("pattern", ""), entry.get("answer", ""))
        console.print(table3)


def _update_selected_sections(profile: dict, answers: dict, custom: list) -> None:
    """Let user pick which sections to update."""
    sections = {
        "1": "Profile info (name, email, phone, city, etc.)",
        "2": "Application questions (work auth, salary, relocation, etc.)",
        "3": "Tech experience (years with specific technologies)",
        "4": "Demographic questions (gender, ethnicity, veteran, disability)",
        "5": "Cover letter",
    }
    console.print("\n[bold cyan]Which sections do you want to update?[/bold cyan]")
    for num, desc in sections.items():
        console.print(f"  [bold]{num}[/bold]. {desc}")

    choices = click.prompt(
        "Enter section numbers (comma-separated, e.g. 1,3)",
        default="1",
    )
    selected = {c.strip() for c in choices.split(",")}

    if "1" in selected:
        _prompt_profile(profile)
    if "2" in selected:
        _prompt_answers(answers)
    if "3" in selected:
        _prompt_tech_experience(custom)
    if "4" in selected:
        _prompt_demographics(custom)
    if "5" in selected:
        _prompt_cover_letter(answers)


def _update_all_sections(profile: dict, answers: dict, custom: list) -> None:
    """Walk through all sections."""
    _prompt_profile(profile)
    _prompt_answers(answers)
    _prompt_tech_experience(custom)
    _prompt_demographics(custom)
    _prompt_cover_letter(answers)


def _prompt_profile(profile: dict) -> None:
    """Prompt for profile fields, showing current values as defaults."""
    console.print("\n[bold cyan]── Profile Info ──[/bold cyan]")
    console.print("[dim]Press Enter to keep the current value.[/dim]")

    fields = [
        ("First name", "first_name", ""),
        ("Last name", "last_name", ""),
        ("Email", "email", ""),
        ("Phone number", "phone", ""),
        ("City", "city", ""),
        ("State/Province", "state", ""),
        ("Country", "country", "United States"),
        ("LinkedIn URL", "linkedin_url", ""),
        ("Website/Portfolio URL", "website", ""),
    ]
    for label, key, fallback in fields:
        current = profile.get(key, fallback)
        profile[key] = click.prompt(label, default=current)

    profile["years_of_experience"] = click.prompt(
        "Total years of experience",
        default=profile.get("years_of_experience", 0),
        type=int,
    )
    profile["resume_path"] = click.prompt(
        "Resume PDF path",
        default=profile.get("resume_path", "resumes/resume.pdf"),
    )


def _prompt_answers(answers: dict) -> None:
    """Prompt for common Easy Apply answer fields."""
    console.print("\n[bold cyan]── Common Application Questions ──[/bold cyan]")
    console.print("[dim]Press Enter to keep the current value.[/dim]")

    answers["authorized_to_work"] = click.confirm(
        "Are you authorized to work in the US?",
        default=answers.get("authorized_to_work", True),
    )
    answers["sponsorship_required"] = click.confirm(
        "Do you require visa sponsorship?",
        default=answers.get("sponsorship_required", False),
    )
    answers["willing_to_relocate"] = click.confirm(
        "Are you willing to relocate?",
        default=answers.get("willing_to_relocate", True),
    )
    answers["desired_salary"] = click.prompt(
        "Desired salary (annual, e.g. 120000)",
        default=answers.get("desired_salary", "0"),
    )
    answers["how_did_you_hear"] = click.prompt(
        "How did you hear about positions?",
        default=answers.get("how_did_you_hear", "LinkedIn"),
    )


def _prompt_tech_experience(custom: list) -> None:
    """Prompt for tech experience patterns."""
    console.print("\n[bold cyan]── Tech Experience ──[/bold cyan]")

    # Show existing tech patterns
    tech_entries = [c for c in custom if "years?" in c.get("pattern", "")]
    if tech_entries:
        console.print("[dim]Current tech experience entries:[/dim]")
        for entry in tech_entries:
            console.print(f"  {entry['pattern']}  =>  [green]{entry['answer']}[/green] years")

    console.print("[dim]Enter comma-separated tech:years pairs (e.g. Python:5,Java:3,React:4)[/dim]")
    console.print("[dim]Press Enter to keep existing.[/dim]")
    tech_input = click.prompt("Tech experience", default="")

    if tech_input:
        for pair in tech_input.split(","):
            pair = pair.strip()
            if ":" in pair:
                tech, years = pair.split(":", 1)
                tech = tech.strip()
                years = years.strip()
                existing = [c for c in custom if tech.lower() in c.get("pattern", "").lower()]
                if existing:
                    existing[0]["answer"] = years
                else:
                    custom.append({"pattern": f"years?.*{re.escape(tech)}", "answer": years})


def _prompt_demographics(custom: list) -> None:
    """Prompt for demographic/EEO question defaults."""
    console.print("\n[bold cyan]── Demographic Questions (EEO/Compliance) ──[/bold cyan]")
    console.print("[dim]These are optional questions some employers ask. Press Enter to keep current.[/dim]")

    # Find current values from custom patterns
    def _get_custom_val(pattern: str, default: str) -> str:
        for entry in custom:
            if entry.get("pattern") == pattern:
                return entry.get("answer", default)
        return default

    demo_fields = [
        ("Gender (or 'Prefer not to say')", "gender", "Prefer not to say"),
        ("Race/Ethnicity (or 'Prefer not to say')", "race|ethnicity", "Prefer not to say"),
        ("Veteran status", "veteran", "No"),
        ("Disability status (or 'Prefer not to say')", "disability", "Prefer not to say"),
    ]

    for label, pattern, fallback in demo_fields:
        current = _get_custom_val(pattern, fallback)
        new_val = click.prompt(label, default=current)
        existing = [c for c in custom if c.get("pattern") == pattern]
        if existing:
            existing[0]["answer"] = new_val
        else:
            custom.append({"pattern": pattern, "answer": new_val})


def _prompt_cover_letter(answers: dict) -> None:
    """Prompt for cover letter text."""
    console.print("\n[bold cyan]── Cover Letter ──[/bold cyan]")
    default_cl = answers.get("cover_letter", "")
    answers["cover_letter"] = click.prompt(
        "Default cover letter text (brief)",
        default=default_cl or "I am excited about this opportunity and believe my skills align well with the role requirements.",
    )


# ── memory ───────────────────────────────────────────────────────────
@cli.command()
@click.option("--clear", is_flag=True, help="Clear all stored question/answer memory")
@click.pass_context
def memory(ctx: click.Context, clear: bool) -> None:
    """View or clear the user memory (learned question→answer pairs).

    The bot remembers answers you provide during apply sessions so it
    never asks the same question twice.
    """
    from linkedin_hunter.forms.memory import UserMemory

    mem = UserMemory()
    entries = mem.get_all()

    if clear:
        if entries and click.confirm(f"Delete all {len(entries)} stored answers?"):
            import os
            from linkedin_hunter.config import get_project_root
            mem_path = get_project_root() / "data" / "user_memory.yaml"
            if mem_path.exists():
                os.remove(mem_path)
            console.print("[green]Memory cleared.[/green]")
        else:
            console.print("[dim]Nothing to clear.[/dim]")
        return

    if not entries:
        console.print("[dim]No stored answers yet. The bot will learn as you apply.[/dim]")
        return

    table = Table(title=f"User Memory ({len(entries)} entries)")
    table.add_column("#", style="dim")
    table.add_column("Question", style="cyan", max_width=50)
    table.add_column("Answer", style="green", max_width=30)
    table.add_column("Used", justify="right")

    for i, (key, entry) in enumerate(entries.items(), 1):
        q = entry.get("question", "")
        if len(q) > 50:
            q = q[:47] + "..."
        table.add_row(
            str(i),
            q,
            entry.get("answer", ""),
            str(entry.get("times_used", 0)),
        )
    console.print(table)


# ── login ────────────────────────────────────────────────────────────
@cli.command()
@click.pass_context
def login(ctx: click.Context) -> None:
    """Open browser for manual LinkedIn login, then save cookies."""
    import asyncio
    from linkedin_hunter.auth.login import interactive_login

    cfg: HunterConfig = ctx.obj["config"]
    asyncio.run(interactive_login(cfg))


# ── search ───────────────────────────────────────────────────────────
@cli.command()
@click.option("-k", "--keywords", default=None, help="Search keywords (overrides config)")
@click.option("-l", "--location", default=None, help="Location (overrides config)")
@click.option("--freshness", default=None, help="How fresh: past-hour, past-3h, past-6h, past-24h, past-week")
@click.option("--limit", default=50, help="Max jobs to fetch")
@click.pass_context
def search(ctx: click.Context, keywords: str | None, location: str | None, freshness: str | None, limit: int) -> None:
    """Search for jobs on LinkedIn and save results."""
    import asyncio
    from linkedin_hunter.jobs.search import run_search

    cfg: HunterConfig = ctx.obj["config"]
    if keywords:
        cfg.search.keywords = keywords
    if location:
        cfg.search.location = location
    if freshness:
        cfg.search.date_posted = freshness

    asyncio.run(run_search(cfg, limit=limit))


# ── apply ────────────────────────────────────────────────────────────
@cli.command()
@click.option("--limit", default=15, help="Max applications this session")
@click.option("--dry-run", is_flag=True, help="Walk through apply flow without submitting")
@click.option("-k", "--keywords", default=None, help="Search keywords (overrides config)")
@click.option("-l", "--location", default=None, help="Location (overrides config)")
@click.option("--freshness", default=None, help="How fresh: past-hour, past-3h, past-6h, past-24h, past-week")
@click.option("--all-jobs", is_flag=True, help="Include non-Easy Apply jobs (auto-handles Workday, etc.)")
@click.pass_context
def apply(ctx: click.Context, limit: int, dry_run: bool, keywords: str | None, location: str | None, freshness: str | None, all_jobs: bool) -> None:
    """Search for jobs and auto-apply.

    By default, only Easy Apply jobs are targeted. Use --all-jobs to also
    handle external application sites like Workday automatically.
    """
    import asyncio
    from linkedin_hunter.jobs.apply import run_apply

    cfg: HunterConfig = ctx.obj["config"]
    if keywords:
        cfg.search.keywords = keywords
    if location:
        cfg.search.location = location
    if freshness:
        cfg.search.date_posted = freshness
    if all_jobs:
        cfg.search.easy_apply_only = False

    asyncio.run(run_apply(cfg, limit=limit, dry_run=dry_run))


# ── status ───────────────────────────────────────────────────────────
@cli.command()
@click.option("--days", default=7, help="Show history for last N days")
@click.pass_context
def status(ctx: click.Context, days: int) -> None:
    """Show application history and statistics."""
    cfg: HunterConfig = ctx.obj["config"]
    root = get_project_root()
    conn = init_db(str(root / "data" / "hunter.db"))

    from linkedin_hunter.db.repository import ApplicationRepository, ActivityRepository

    app_repo = ApplicationRepository(conn)
    act_repo = ActivityRepository(conn)

    # Application history
    apps = app_repo.get_applications(days=days)
    if not apps:
        console.print(f"[yellow]No applications found in the last {days} days.[/yellow]")
    else:
        table = Table(title=f"Applications (last {days} days)")
        table.add_column("#", style="dim")
        table.add_column("Date", style="cyan")
        table.add_column("Company", style="green")
        table.add_column("Title")
        table.add_column("Status")
        table.add_column("Dry Run")

        for i, app in enumerate(apps, 1):
            status_style = {
                "submitted": "bold green",
                "failed": "bold red",
                "skipped": "yellow",
                "pending": "dim",
            }.get(app["status"], "")
            table.add_row(
                str(i),
                app["applied_at"][:16],
                app["company"],
                app["title"],
                f"[{status_style}]{app['status']}[/{status_style}]",
                "Yes" if app["dry_run"] else "No",
            )
        console.print(table)

    # Daily stats
    stats = act_repo.get_daily_stats(days=days)
    if stats:
        st = Table(title="Daily Stats")
        st.add_column("Date", style="cyan")
        st.add_column("Applications", justify="right")
        st.add_column("Searches", justify="right")
        st.add_column("Errors", justify="right", style="red")
        for row in stats:
            st.add_row(row["date"], str(row["applications"]), str(row["searches"]), str(row["errors"]))
        console.print(st)

    # Summary
    today_count = app_repo.count_today()
    console.print(f"\n[bold]Today's applications:[/bold] {today_count}")
    conn.close()


# ── workday-apply ────────────────────────────────────────────────────
@cli.command("workday-apply")
@click.argument("urls", nargs=-1, required=True)
@click.option("--dry-run", is_flag=True, help="Walk through forms without submitting")
@click.pass_context
def workday_apply(ctx: click.Context, urls: tuple[str, ...], dry_run: bool) -> None:
    """Apply to Workday job postings.

    Provide one or more Workday job URLs as arguments.

    Example:
        linkedin-hunter workday-apply "https://company.wd5.myworkdayjobs.com/..."
    """
    import asyncio
    from linkedin_hunter.workday.apply import run_workday_apply

    cfg: HunterConfig = ctx.obj["config"]
    asyncio.run(run_workday_apply(cfg, list(urls), dry_run=dry_run))


# ── workday-apply-file ───────────────────────────────────────────────
@cli.command("workday-apply-file")
@click.argument("file", type=click.Path(exists=True))
@click.option("--dry-run", is_flag=True, help="Walk through forms without submitting")
@click.option("--limit", default=0, help="Max jobs to apply to (0 = all)")
@click.pass_context
def workday_apply_file(ctx: click.Context, file: str, dry_run: bool, limit: int) -> None:
    """Apply to Workday jobs from a file (one URL per line).

    The file should contain one Workday job URL per line.
    Lines starting with # are treated as comments.

    Example:
        linkedin-hunter workday-apply-file workday_jobs.txt --limit 5
    """
    import asyncio
    from pathlib import Path
    from linkedin_hunter.workday.apply import run_workday_apply
    from linkedin_hunter.workday.constants import is_workday_url

    cfg: HunterConfig = ctx.obj["config"]

    # Read URLs from file
    urls = []
    for line in Path(file).read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            if is_workday_url(line):
                urls.append(line)
            else:
                console.print(f"[yellow]Skipping non-Workday URL: {line}[/yellow]")

    if not urls:
        console.print("[red]No valid Workday URLs found in file.[/red]")
        return

    if limit > 0:
        urls = urls[:limit]

    console.print(f"[bold]Found {len(urls)} Workday job URLs[/bold]")
    asyncio.run(run_workday_apply(cfg, urls, dry_run=dry_run))
