"""Workday form filler — React-aware field filling.

Handles Workday's React controlled components properly by using
Playwright's fill() + type() which dispatch correct synthetic events,
plus custom dropdown handling for Workday's combobox components.
"""

from __future__ import annotations

import asyncio
import random
import re
from pathlib import Path
from typing import Optional

from playwright.async_api import Page, ElementHandle

from linkedin_hunter.browser.humanize import short_delay
from linkedin_hunter.config import HunterConfig, get_project_root
from linkedin_hunter.forms.memory import UserMemory
from linkedin_hunter.forms.questions import match_answer, match_yes_no, match_multi_option
from linkedin_hunter.forms.user_prompt import prompt_user_for_input
from linkedin_hunter.utils.logging import get_logger
from linkedin_hunter.utils.shutdown import is_shutting_down
from linkedin_hunter.workday.constants import FIELD_SELECTORS, WORKDAY_DELAYS
from linkedin_hunter.workday.detector import WDFormField, WDFieldType

log = get_logger(__name__)

# Singleton memory
_memory: UserMemory | None = None


def _get_memory() -> UserMemory:
    global _memory
    if _memory is None:
        _memory = UserMemory()
    return _memory


async def fill_workday_fields(
    page: Page,
    fields: list[WDFormField],
    config: HunterConfig,
    resume_text: str | None = None,
) -> tuple[int, int]:
    """Fill all detected Workday form fields.

    Returns (filled_count, skipped_count).
    """
    filled = 0
    skipped = 0

    for field in fields:
        if is_shutting_down():
            break

        try:
            success = await _fill_field(page, field, config, resume_text)
            if success:
                filled += 1
            else:
                skipped += 1
        except Exception as e:
            log.warning("Error filling Workday field '%s': %s", field.label, e)
            skipped += 1

        # Human-like delay between fields
        delay = random.uniform(*WORKDAY_DELAYS["between_fields"])
        await asyncio.sleep(delay)

    log.info("Workday fill: filled=%d, skipped=%d", filled, skipped)
    return filled, skipped


async def _fill_field(
    page: Page,
    field: WDFormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a single Workday form field."""

    if field.field_type == WDFieldType.FILE_UPLOAD:
        return await _fill_file_upload(field, config)

    if field.field_type == WDFieldType.TEXT:
        return await _fill_text(page, field, config, resume_text)

    if field.field_type == WDFieldType.TEXTAREA:
        return await _fill_textarea(page, field, config, resume_text)

    if field.field_type == WDFieldType.DROPDOWN:
        return await _fill_dropdown(page, field, config, resume_text)

    if field.field_type == WDFieldType.NATIVE_SELECT:
        return await _fill_native_select(page, field, config, resume_text)

    if field.field_type == WDFieldType.RADIO:
        return await _fill_radio(page, field, config, resume_text)

    if field.field_type == WDFieldType.CHECKBOX:
        return await _fill_checkbox(page, field, config)

    if field.field_type == WDFieldType.DATE:
        return await _fill_date(page, field, config)

    return False


def _resolve_answer(
    field: WDFormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> Optional[str]:
    """Resolve the answer for a field using config, profile, memory, etc."""

    # 1. If the field has a known config_key mapping, use it directly
    if field.config_key:
        val = _get_config_value(field.config_key, config)
        if val:
            return val

    # 2. Try pattern matching from config/answers/profile
    answer = match_answer(field.label, config.answers, config.profile)
    if answer:
        return answer

    # 3. Check user memory
    mem_answer = _get_memory().lookup(field.label)
    if mem_answer:
        return mem_answer

    return None


def _get_config_value(key: str, config: HunterConfig) -> Optional[str]:
    """Get a value from config by key name."""
    # Check profile
    profile_map = {
        "first_name": config.profile.first_name,
        "last_name": config.profile.last_name,
        "email": config.profile.email,
        "phone": config.profile.phone,
        "city": config.profile.city,
        "state": config.profile.state,
        "country": config.profile.country,
        "linkedin_url": config.profile.linkedin_url,
        "website": config.profile.website,
        "years_of_experience": str(config.profile.years_of_experience),
        "how_did_you_hear": config.answers.how_did_you_hear,
        "zip_code": "",  # Not in config yet
        "address": "",
    }
    val = profile_map.get(key, "")
    return val if val else None


async def _fill_text(
    page: Page,
    field: WDFormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a text input using React-compatible events."""
    if field.current_value:
        log.debug("Workday text field '%s' already filled: %s", field.label, field.current_value)
        return True

    answer = _resolve_answer(field, config, resume_text)

    # Fallback for required fields: ask user
    if answer is None and field.required:
        answer = await _ask_user(field)

    if answer is None:
        return not field.required

    # React-compatible filling:
    # 1. Click to focus
    await field.element.click()
    await asyncio.sleep(0.2)

    # 2. Clear existing content
    await field.element.fill("")
    await asyncio.sleep(0.1)

    # 3. Type character by character (triggers React onChange)
    delay = random.randint(*WORKDAY_DELAYS["typing_delay_ms"])
    await field.element.type(answer, delay=delay)

    # 4. Tab out to trigger onBlur validation
    await page.keyboard.press("Tab")
    await asyncio.sleep(0.3)

    log.info("Filled Workday text '%s' with '%s'", field.label, answer[:30])
    return True


async def _fill_textarea(
    page: Page,
    field: WDFormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a textarea field."""
    if field.current_value:
        return True

    answer = _resolve_answer(field, config, resume_text)

    if answer is None and field.required:
        answer = await _ask_user(field)

    if answer is None:
        return not field.required

    await field.element.click()
    await asyncio.sleep(0.2)
    await field.element.fill(answer)
    await page.keyboard.press("Tab")
    await asyncio.sleep(0.3)

    log.info("Filled Workday textarea '%s'", field.label)
    return True


async def _fill_dropdown(
    page: Page,
    field: WDFormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a Workday React combobox/dropdown.

    Pattern: click trigger → type to search → select option from list.
    """
    if field.current_value:
        log.debug("Workday dropdown '%s' already has value: %s", field.label, field.current_value)
        return True

    answer = _resolve_answer(field, config, resume_text)

    if answer is None and field.required:
        answer = await _ask_user(field)

    if answer is None:
        return not field.required

    try:
        # Step 1: Click the dropdown trigger to open it
        await field.element.click()
        await asyncio.sleep(random.uniform(*WORKDAY_DELAYS["after_dropdown_open"]))

        # Step 2: Find the search box inside the dropdown
        search_box = await page.query_selector(FIELD_SELECTORS["dropdown_search"])
        if search_box:
            # Type the answer to filter options
            await search_box.fill("")
            await search_box.type(answer, delay=random.randint(30, 60))
            await asyncio.sleep(0.8)  # Wait for results to filter

        # Step 3: Select the first matching option
        options = await page.query_selector_all(FIELD_SELECTORS["dropdown_option"])

        # Try exact match first, then partial
        selected = False
        for opt in options:
            opt_text = ((await opt.text_content()) or "").strip()
            if opt_text.lower() == answer.lower():
                await opt.click()
                selected = True
                log.info("Selected dropdown exact match '%s' for '%s'", opt_text, field.label)
                break

        if not selected:
            for opt in options:
                opt_text = ((await opt.text_content()) or "").strip()
                if answer.lower() in opt_text.lower() or opt_text.lower() in answer.lower():
                    await opt.click()
                    selected = True
                    log.info("Selected dropdown partial match '%s' for '%s'", opt_text, field.label)
                    break

        if not selected and options:
            # Last resort: click the first visible option
            await options[0].click()
            first_text = ((await options[0].text_content()) or "").strip()
            log.warning("No dropdown match for '%s', selected first: '%s'", field.label, first_text)
            selected = True

        await asyncio.sleep(random.uniform(*WORKDAY_DELAYS["after_dropdown_select"]))

        # Press Escape to close dropdown if still open
        await page.keyboard.press("Escape")
        await asyncio.sleep(0.2)

        return selected

    except Exception as e:
        log.warning("Error filling Workday dropdown '%s': %s", field.label, e)
        # Try to close any open dropdown
        try:
            await page.keyboard.press("Escape")
        except Exception:
            pass
        return False


async def _fill_native_select(
    page: Page,
    field: WDFormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a native <select> dropdown."""
    answer = _resolve_answer(field, config, resume_text)
    if answer is None:
        # Try yes/no matching
        yes_no = match_yes_no(field.label, config.answers)
        if yes_no is not None:
            answer = "Yes" if yes_no else "No"

    if answer is None and field.required:
        answer = await _ask_user(field)

    if answer is None:
        return not field.required

    # Try exact match
    for opt in field.options:
        if opt.lower() == answer.lower():
            await field.element.select_option(label=opt)
            log.info("Selected native '%s' for '%s'", opt, field.label)
            return True

    # Partial match
    for opt in field.options:
        if answer.lower() in opt.lower() or opt.lower() in answer.lower():
            await field.element.select_option(label=opt)
            log.info("Selected native (partial) '%s' for '%s'", opt, field.label)
            return True

    # First non-empty option
    if field.required and field.options:
        await field.element.select_option(label=field.options[0])
        log.warning("No match for native select '%s', picked first: %s", field.label, field.options[0])
        return True

    return not field.required


async def _fill_radio(
    page: Page,
    field: WDFormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a radio button group."""
    # Try yes/no
    yes_no = match_yes_no(field.label, config.answers)
    if yes_no is not None:
        target = "Yes" if yes_no else "No"
        if await _click_radio_option(page, field, target):
            return True

    # Try multi-option patterns
    if field.options:
        multi = match_multi_option(field.label, field.options)
        if multi:
            if await _click_radio_option(page, field, multi):
                return True

    # Try config answer
    answer = _resolve_answer(field, config, resume_text)
    if answer:
        if await _click_radio_option(page, field, answer):
            return True

    # Ask user
    if field.required:
        user_answer = await _ask_user(field)
        if user_answer:
            if await _click_radio_option(page, field, user_answer):
                return True

    return not field.required


async def _click_radio_option(page: Page, field: WDFormField, target: str) -> bool:
    """Click a radio option by finding its label."""
    try:
        parent = await field.element.evaluate_handle(
            "el => el.closest('fieldset') || el.closest('[role=\"radiogroup\"]') || el.parentElement.parentElement.parentElement"
        )
        el = parent.as_element()
        if not el:
            return False

        labels = await el.query_selector_all("label")

        # Exact match
        for lbl in labels:
            text = ((await lbl.text_content()) or "").strip()
            if text.lower() == target.lower():
                await lbl.click()
                await asyncio.sleep(0.3)
                log.info("Selected Workday radio '%s' for '%s'", text, field.label)
                return True

        # Partial match
        for lbl in labels:
            text = ((await lbl.text_content()) or "").strip()
            if target.lower() in text.lower() or text.lower() in target.lower():
                await lbl.click()
                await asyncio.sleep(0.3)
                log.info("Selected Workday radio (partial) '%s' for '%s'", text, field.label)
                return True

    except Exception as e:
        log.warning("Error clicking Workday radio: %s", e)
    return False


async def _fill_checkbox(
    page: Page,
    field: WDFormField,
    config: HunterConfig,
) -> bool:
    """Fill a checkbox field."""
    is_checked = field.current_value == "true"

    # Agreement / acknowledgment checkboxes: check them
    q = field.label.lower()
    if any(kw in q for kw in ["agree", "consent", "acknowledge", "confirm", "certif", "terms"]):
        if not is_checked:
            await field.element.check()
            log.info("Checked Workday checkbox '%s'", field.label)
        return True

    # Required unchecked checkbox: check it
    if field.required and not is_checked:
        await field.element.check()
        log.info("Checked required Workday checkbox '%s'", field.label)

    return True


async def _fill_date(
    page: Page,
    field: WDFormField,
    config: HunterConfig,
) -> bool:
    """Fill a Workday date field (separate m/d/y inputs)."""
    # Workday dates are complex — skip for now, let user fill manually
    log.info("Skipping date field '%s' (user should fill manually)", field.label)
    return not field.required


async def _fill_file_upload(field: WDFormField, config: HunterConfig) -> bool:
    """Upload resume to a Workday file upload field."""
    resume_path = Path(config.profile.resume_path)
    if not resume_path.is_absolute():
        resume_path = get_project_root() / resume_path

    if not resume_path.exists():
        log.warning("Resume file not found: %s", resume_path)
        return False

    await field.element.set_input_files(str(resume_path))
    log.info("Uploaded resume to Workday: %s", resume_path.name)
    return True


async def _ask_user(field: WDFormField) -> Optional[str]:
    """Ask user for input with blinking prompt for this application."""
    user_answer = await prompt_user_for_input(
        question=field.label,
        field_type=field.field_type.value,
        options=field.options if field.options else None,
    )
    return user_answer
