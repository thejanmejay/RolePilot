"""Fill Easy Apply form fields from config, resume data, and pattern matching."""

from __future__ import annotations

import asyncio
import re
import random
from pathlib import Path
from typing import Optional

from playwright.async_api import Page

from linkedin_hunter.browser.humanize import short_delay
from linkedin_hunter.config import HunterConfig, get_project_root
from linkedin_hunter.forms.detector import FormField, FieldType
from linkedin_hunter.forms.memory import UserMemory
from linkedin_hunter.forms.questions import (
    match_answer, match_yes_no, match_multi_option, match_select_option,
)
from linkedin_hunter.forms.user_prompt import prompt_user_for_input
from linkedin_hunter.utils.logging import get_logger

log = get_logger(__name__)

# Module-level user memory instance (loaded once, reused across calls)
_user_memory: UserMemory | None = None


def _get_memory() -> UserMemory:
    """Get or initialize the singleton UserMemory instance."""
    global _user_memory
    if _user_memory is None:
        _user_memory = UserMemory()
    return _user_memory


async def fill_form_fields(
    page: Page,
    fields: list[FormField],
    config: HunterConfig,
    resume_text: str | None = None,
) -> tuple[int, int]:
    """Fill all detected form fields. Returns (filled_count, skipped_count)."""
    filled = 0
    skipped = 0

    for field in fields:
        try:
            success = await _fill_field(page, field, config, resume_text)
            if success:
                filled += 1
            else:
                skipped += 1
        except Exception as e:
            log.warning("Error filling field '%s': %s", field.label, e)
            skipped += 1

    log.info("Filled %d fields, skipped %d", filled, skipped)
    return filled, skipped


async def _fill_field(
    page: Page,
    field: FormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a single form field. Returns True if filled."""
    await short_delay()

    if field.field_type == FieldType.FILE_UPLOAD:
        return await _fill_file_upload(field, config)

    if field.field_type == FieldType.TEXT:
        return await _fill_text(page, field, config, resume_text)

    if field.field_type == FieldType.TEXTAREA:
        return await _fill_textarea(page, field, config, resume_text)

    if field.field_type == FieldType.SELECT:
        return await _fill_select(page, field, config, resume_text)

    if field.field_type == FieldType.RADIO:
        return await _fill_radio(page, field, config, resume_text)

    if field.field_type == FieldType.CHECKBOX:
        return await _fill_checkbox(page, field, config)

    return False


def _is_numeric_field(field: FormField) -> bool:
    """Check if a field expects a numeric answer based on its label."""
    q = field.label.lower()
    numeric_indicators = [
        r"(in\s*)?days?\b",           # "in days", "days"
        r"out\s*of\s*\d+",            # "out of 10"
        r"rate\s*(yourself|your)",     # "rate yourself"
        r"scale\s*of",                # "scale of 1-10"
        r"on\s*a\s*scale",            # "on a scale"
        r"how\s*many\s*(day|month|year|hour)", # "how many days"
        r"\(\s*in\s*(days?|months?|years?|hours?)\s*\)",  # "(in days)"
        r"number\s*of\s*(day|month|year)",  # "number of days"
        r"specify\s*in\s*(day|month|year)",  # "specify in days"
    ]
    return any(re.search(p, q) for p in numeric_indicators)


def _get_numeric_answer(label: str, config: HunterConfig) -> Optional[str]:
    """Get a numeric answer for fields that require numbers."""
    q = label.lower()

    # Notice period / days to join / when can you start (in days)
    if re.search(r"(notice.?period|how many days.*(join|start)|days.*(join|start)|join.*(day|within)|commit.*(join|within))", q):
        return "0"

    # Rate yourself / scale questions
    if re.search(r"(rate\s*(yourself|your)|out\s*of\s*10|scale\s*of\s*(1|0).*(10|5)|on\s*a\s*scale)", q):
        return "7"

    # How many months / years of experience (numeric only field)
    if re.search(r"(how\s*many\s*(month|year).*experience|month.*experience|experience.*month)", q):
        return str(config.profile.years_of_experience * 12) if "month" in q else str(config.profile.years_of_experience)

    # Salary in numeric-only field
    if re.search(r"(salary|compensation|ctc|pay|earning|remuneration).*(number|amount|figure|numeric)?", q):
        if re.search(r"month", q):
            return "5000"
        return config.answers.desired_salary or "60000"

    # Number of days available / start / availability
    if re.search(r"(number\s*of\s*days|available.*(in|within)\s*\d*\s*days|specify\s*in\s*days)", q):
        return "0"

    return None


def _extract_from_resume(question: str, resume_text: str) -> Optional[str]:
    """Try to extract an answer from resume text based on the question asked.

    Handles common Easy Apply questions like years of experience with specific
    technologies, GPA, university name, degree, etc.
    """
    q = question.lower()

    # Years of experience with a specific technology
    tech_match = re.search(r"years?.*(experience|proficien).*(with|in|using)?\s*(\w[\w\s#\+\.]*)", q)
    if not tech_match:
        tech_match = re.search(r"how\s+(?:many\s+)?years?.*?(\w[\w\s#\+\.]+)", q)
    if tech_match:
        tech = tech_match.group(tech_match.lastindex or 1).strip().lower()
        # Look for the technology in resume and try to estimate years
        if re.search(re.escape(tech), resume_text, re.IGNORECASE):
            # Found the tech in resume — return a reasonable default
            return None  # Let config answer handle this (custom patterns)

    # University / school name
    if re.search(r"(?i)(university|school|college|alma mater|education)", q):
        edu_match = re.search(
            r"(?:university|college|institute|school)\s+of\s+[\w\s]+|"
            r"[\w\s]+(?:university|college|institute|school)",
            resume_text, re.IGNORECASE,
        )
        if edu_match:
            return edu_match.group(0).strip()

    # Degree
    if re.search(r"(?i)(degree|qualification|education level)", q):
        for pattern, degree in [
            (r"(?i)\bph\.?d\.?\b", "Doctorate"),
            (r"(?i)\bm\.?s\.?\b|master", "Master's Degree"),
            (r"(?i)\bm\.?b\.?a\.?\b", "Master's Degree"),
            (r"(?i)\bb\.?s\.?\b|bachelor", "Bachelor's Degree"),
            (r"(?i)\bb\.?a\.?\b", "Bachelor's Degree"),
            (r"(?i)\bassociate", "Associate's Degree"),
        ]:
            if re.search(pattern, resume_text):
                return degree

    # GPA
    if re.search(r"(?i)\bgpa\b", q):
        gpa_match = re.search(r"(?i)gpa[:\s]*([0-4]\.\d{1,2})", resume_text)
        if gpa_match:
            return gpa_match.group(1)

    # LinkedIn profile
    if re.search(r"(?i)linkedin.*(url|profile|link)", q):
        li_match = re.search(r"linkedin\.com/in/[\w\-]+", resume_text, re.IGNORECASE)
        if li_match:
            return "https://www." + li_match.group(0)

    # GitHub / portfolio
    if re.search(r"(?i)(github|portfolio|website|personal.*(url|site|link))", q):
        gh_match = re.search(r"github\.com/[\w\-]+", resume_text, re.IGNORECASE)
        if gh_match:
            return "https://" + gh_match.group(0)

    return None


async def _fill_text(
    page: Page,
    field: FormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a text input field."""
    # Skip if already filled
    if field.current_value:
        log.debug("Field '%s' already has value: %s", field.label, field.current_value)
        return True

    # Try config/profile pattern matching first
    answer = match_answer(field.label, config.answers, config.profile)

    # Check if this is a numeric field and the answer might not be numeric
    if answer and _is_numeric_field(field):
        # Validate the answer is numeric; if not, get a numeric one
        try:
            float(answer)
        except ValueError:
            numeric = _get_numeric_answer(field.label, config)
            if numeric:
                answer = numeric

    # If no answer yet, try numeric detection
    if answer is None and _is_numeric_field(field):
        answer = _get_numeric_answer(field.label, config)

    # Fallback: try extracting from resume
    if answer is None and resume_text:
        answer = _extract_from_resume(field.label, resume_text)

    # Check user memory before falling back
    if answer is None:
        memory = _get_memory()
        answer = memory.lookup(field.label)

    # Last resort for required fields: try generic fallback
    if answer is None and field.required:
        answer = _text_fallback(field.label, config)

    # Still stuck on a required field → ask the user with blinking prompt
    if answer is None and field.required:
        user_answer = await prompt_user_for_input(
            question=field.label,
            field_type="text",
        )
        if user_answer:
            _get_memory().store(field.label, user_answer)
            answer = user_answer

    if answer is None:
        log.debug("No answer for text field: %s", field.label)
        return not field.required  # OK to skip non-required fields

    await field.element.click()
    await asyncio.sleep(random.uniform(0.1, 0.3))
    await field.element.fill("")
    # Type character by character for human-like behavior
    for char in answer:
        await page.keyboard.type(char, delay=random.uniform(30, 100))

    # Handle typeahead/autocomplete dropdowns (e.g., City fields)
    await asyncio.sleep(0.8)
    typeahead_option = await page.query_selector(
        "div.basic-typeahead__triggered-content li:first-child, "
        "div.search-typeahead-v2__hit:first-child, "
        "div[data-test-single-typeahead-entity-form-search-result]:first-child"
    )
    if typeahead_option:
        await typeahead_option.click()
        log.info("Selected typeahead suggestion for '%s'", field.label)
        await asyncio.sleep(0.3)

    log.info("Filled text field '%s' with '%s'", field.label, answer[:30])
    return True


def _text_fallback(label: str, config: HunterConfig) -> Optional[str]:
    """Provide sensible fallback answers for required text fields."""
    q = label.lower()

    # Catch-all "years of experience in <anything>" → default to profile years
    if re.search(r"(years?|how many|how much).*(experience|work|proficien)", q):
        return str(config.profile.years_of_experience)

    # Any "how many" question with no match → try numeric
    if re.search(r"how\s*many", q):
        return str(config.profile.years_of_experience)

    # Referral / who referred → N/A
    if re.search(r"(referr|who.*refer|employee.*name|referred\s*by)", q):
        return "N/A"

    # LinkedIn URL patterns that weren't caught
    if re.search(r"(?i)(linkedin|perfil)", q):
        return config.profile.linkedin_url or ""

    # Current company / employer
    if re.search(r"(current|present).*(company|employer|organization)", q):
        return "N/A"

    # Expected joining date / start date → Immediately
    if re.search(r"(join|start).*(date|when)", q):
        return "Immediately"

    return None


async def _fill_textarea(
    page: Page,
    field: FormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a textarea field."""
    if field.current_value:
        return True

    answer = match_answer(field.label, config.answers, config.profile)

    # Fallback: try extracting from resume
    if answer is None and resume_text:
        answer = _extract_from_resume(field.label, resume_text)

    # Check user memory before falling back
    if answer is None:
        memory = _get_memory()
        answer = memory.lookup(field.label)

    # Fallback for required textareas: try smart defaults
    if answer is None and field.required:
        answer = _textarea_fallback(field.label, config)

    # Still stuck on a required field → ask the user
    if answer is None and field.required:
        user_answer = await prompt_user_for_input(
            question=field.label,
            field_type="textarea",
        )
        if user_answer:
            _get_memory().store(field.label, user_answer)
            answer = user_answer

    if answer is None:
        return not field.required

    await field.element.click()
    await field.element.fill(answer)
    log.info("Filled textarea '%s'", field.label)
    return True


def _textarea_fallback(label: str, config: HunterConfig) -> Optional[str]:
    """Provide sensible fallback answers for required textareas."""
    q = label.lower()

    # "Where did you hear" / "How did you hear" — multi-language
    if re.search(r"(where|how).*(hear|learn|find|know)", q):
        return config.answers.how_did_you_hear or "LinkedIn"
    if re.search(r"(c[oó]mo|onde|comment|wie|dove).*(enterar|conhec|soube|avez|erfahren|scoperto|enteraste)", q):
        return config.answers.how_did_you_hear or "LinkedIn"

    # Cover letter / tell us about yourself / why interested — multi-language
    if re.search(r"(cover.?letter|tell.*(us|me).*about|why.*(interest|apply|join)|additional.?info)", q):
        return config.answers.cover_letter or "I am excited about this opportunity."
    if re.search(r"(carta.*(presentaci|motivaci)|lettre.*motivation|por.?qu[eé].*(interes|aplicar))", q):
        return config.answers.cover_letter or "I am excited about this opportunity."

    # Chat channels / communication / contact method
    if re.search(r"(chat|channel|zalo|whatsapp|telegram|contact.*(method|prefer)|communication|canal)", q):
        return "LinkedIn"

    # Referral / who referred — multi-language
    if re.search(r"(referr|who.*refer|familiar.*amigo|pariente.*trabaj|connaissez.*ami)", q):
        return "N/A"
    if re.search(r"(tiene.*familiar|tiene.*amigo|tiene.*conocido).*(trabaj|empresa|compañía)", q):
        return "No"

    # Reside / live in a specific location — check if it's asking about a different country
    if re.search(r"(reside|live|located|work from|currently.*(in|at|based))", q):
        user_country = (config.profile.country or "").lower()
        user_city = (config.profile.city or "").lower()
        if user_country and user_country in q:
            return "Yes"
        if user_city and user_city in q:
            return "Yes"
        if re.search(r"(?i)(vietnam|japan|china|korea|brazil|germany|uk|australia|canada|france|spain|italy|portugal)", q):
            return "No"
        return f"{config.profile.city}, {config.profile.country}" if config.profile.city else "No"

    # Anything about experience / skills / describe — multi-language
    if re.search(r"(describe|explain|experience|skill|background|summary|about.*(you|yourself))", q):
        return config.answers.cover_letter or "I have relevant experience for this role."
    if re.search(r"(descri[bp]|explica|experiencia|habilidad|competencia|résumé|zusammenfassung)", q):
        return config.answers.cover_letter or "I have relevant experience for this role."

    # LinkedIn URL / profile — multi-language
    if re.search(r"(linkedin|perfil.*linkedin|profil.*linkedin)", q):
        return config.profile.linkedin_url or ""

    # Generic required textarea — use a brief safe answer
    log.warning("No specific fallback for required textarea: '%s', using generic", label[:60])
    return "N/A"


async def _fill_select(
    page: Page,
    field: FormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a select dropdown."""
    # Check if already has a selected value (LinkedIn pre-fills some selects)
    try:
        current_val = await field.element.input_value()
        if current_val and current_val.strip() and current_val != "Select an option":
            log.debug("Select '%s' already has value: %s", field.label, current_val)
            return True
    except Exception:
        pass

    # Try Yes/No matching first (only for questions that are clearly yes/no)
    yes_no = match_yes_no(field.label, config.answers)
    if yes_no is not None:
        target = "Yes" if yes_no else "No"
        for opt in field.options:
            if opt.lower() == target.lower():
                await field.element.select_option(label=opt)
                log.info("Selected '%s' for '%s'", opt, field.label)
                return True

    # Try text answer matching from config
    answer = match_answer(field.label, config.answers, config.profile)

    # Fallback: try resume
    if answer is None and resume_text:
        answer = _extract_from_resume(field.label, resume_text)

    if answer:
        # Try exact match
        for opt in field.options:
            if opt.lower() == answer.lower():
                await field.element.select_option(label=opt)
                log.info("Selected '%s' for '%s'", opt, field.label)
                return True
        # Try partial match
        for opt in field.options:
            if answer.lower() in opt.lower() or opt.lower() in answer.lower():
                await field.element.select_option(label=opt)
                log.info("Selected '%s' (partial match) for '%s'", opt, field.label)
                return True
        # For numeric answers, also try matching just the number
        if answer.isdigit():
            for opt in field.options:
                opt_stripped = opt.strip()
                # Match "4" against "4 years", "4+", "3-5" (if 4 is in range)
                if opt_stripped == answer or opt_stripped.startswith(answer + " ") or opt_stripped.startswith(answer + "+"):
                    await field.element.select_option(label=opt)
                    log.info("Selected '%s' (numeric match) for '%s'", opt, field.label)
                    return True
                # Try matching ranges like "3-5" when answer is "4"
                range_match = re.match(r"(\d+)\s*[-–]\s*(\d+)", opt_stripped)
                if range_match:
                    low, high = int(range_match.group(1)), int(range_match.group(2))
                    if low <= int(answer) <= high:
                        await field.element.select_option(label=opt)
                        log.info("Selected '%s' (range match) for '%s'", opt, field.label)
                        return True

    # Try SELECT_OPTION_PATTERNS for known question types
    if field.options:
        select_match = match_select_option(field.label, field.options)
        if select_match:
            await field.element.select_option(label=select_match)
            log.info("Selected '%s' (select pattern) for '%s'", select_match, field.label)
            return True

    # Check user memory for select fields
    if field.options:
        memory = _get_memory()
        mem_answer = memory.lookup(field.label)
        if mem_answer:
            for opt in field.options:
                if mem_answer.lower() in opt.lower() or opt.lower() in mem_answer.lower():
                    await field.element.select_option(label=opt)
                    log.info("Selected '%s' (from memory) for '%s'", opt, field.label)
                    return True

    # If required and has options, ask user before falling back to smart defaults
    if field.required and field.options:
        user_answer = await prompt_user_for_input(
            question=field.label,
            field_type="select",
            options=field.options,
        )
        if user_answer:
            _get_memory().store(field.label, user_answer)
            for opt in field.options:
                if user_answer.lower() in opt.lower() or opt.lower() in user_answer.lower():
                    await field.element.select_option(label=opt)
                    log.info("Selected '%s' (user input) for '%s'", opt, field.label)
                    return True

    # If required and has options, try smart fallback
    if field.required and field.options:
        # Determine appropriate defaults based on question context
        q = field.label.lower()

        # Questions that should default to "Yes"
        yes_contexts = [
            r"(read|review|understand|agree|consent|confirm|acknowledge)",
            r"(open|willing|comfortable|able|ready)",
            r"(background|drug|screen)",
            r"(experience|proficien|familiar|knowledge)",
        ]
        for ctx in yes_contexts:
            if re.search(ctx, q):
                for opt in field.options:
                    if opt.lower() in ("yes", "true", "si", "sí", "oui", "ja", "sim"):
                        await field.element.select_option(label=opt)
                        log.info("Smart fallback (yes-context) for select '%s': picked '%s'", field.label, opt)
                        return True

        # Try standard smart defaults
        smart_defaults = ["yes", "no", "confirmed", "n/a", "prefer not", "decline"]
        for default in smart_defaults:
            for opt in field.options:
                if opt.lower().startswith(default) or default in opt.lower():
                    await field.element.select_option(label=opt)
                    log.info("Smart fallback for select '%s': picked '%s'", field.label, opt)
                    return True

        # Last resort: first non-empty option
        if field.options:
            await field.element.select_option(label=field.options[0])
            log.warning("No match for required select '%s', picked first option: %s", field.label, field.options[0])
            return True

    return not field.required


async def _fill_radio(
    page: Page,
    field: FormField,
    config: HunterConfig,
    resume_text: str | None = None,
) -> bool:
    """Fill a radio button group."""
    log.info("Filling radio field: '%s' (options: %s)", field.label, field.options)

    # 1. Try Yes/No matching (for simple Yes/No radio groups)
    yes_no = match_yes_no(field.label, config.answers)
    if yes_no is not None:
        target = "Yes" if yes_no else "No"
        log.info("Yes/No match for '%s': selecting '%s'", field.label, target)
        clicked = await _click_radio_option(page, field, target)
        if clicked:
            return True

    # 2. Try multi-option matching (citizenship, gender, disability, veteran, etc.)
    if field.options:
        multi_match = match_multi_option(field.label, field.options)
        if multi_match:
            log.info("Multi-option match for '%s': selecting '%s'", field.label, multi_match)
            clicked = await _click_radio_option(page, field, multi_match)
            if clicked:
                return True

    # 3. Try text answer matching from config/custom patterns
    answer = match_answer(field.label, config.answers, config.profile)
    if answer is None and resume_text:
        answer = _extract_from_resume(field.label, resume_text)

    if answer:
        # Try direct match first
        clicked = await _click_radio_option(page, field, answer)
        if clicked:
            return True
        # Try partial match against options
        for opt in field.options:
            if answer.lower() in opt.lower() or opt.lower() in answer.lower():
                clicked = await _click_radio_option(page, field, opt)
                if clicked:
                    return True

    # 4. Check user memory
    memory = _get_memory()
    mem_answer = memory.lookup(field.label)
    if mem_answer:
        clicked = await _click_radio_option(page, field, mem_answer)
        if clicked:
            return True
        for opt in field.options:
            if mem_answer.lower() in opt.lower() or opt.lower() in mem_answer.lower():
                clicked = await _click_radio_option(page, field, opt)
                if clicked:
                    return True

    # 5. Ask user if still stuck on required field
    if field.required:
        user_answer = await prompt_user_for_input(
            question=field.label,
            field_type="radio",
            options=field.options,
        )
        if user_answer:
            _get_memory().store(field.label, user_answer)
            clicked = await _click_radio_option(page, field, user_answer)
            if clicked:
                return True
            for opt in field.options:
                if user_answer.lower() in opt.lower() or opt.lower() in user_answer.lower():
                    clicked = await _click_radio_option(page, field, opt)
                    if clicked:
                        return True

    return not field.required


async def _click_radio_option(page: Page, field: FormField, target: str) -> bool:
    """Click a radio option matching target text."""
    try:
        # Strategy 1: Use the fieldset containing this radio button
        parent = await field.element.evaluate_handle(
            "el => el.closest('fieldset') || el.closest('[data-test-form-builder-radio-button-form-component]') || el.parentElement.parentElement"
        )
        el = parent.as_element()
        if el:
            labels = await el.query_selector_all("label")
            # First pass: exact match
            for lbl in labels:
                text = (await lbl.text_content() or "").strip()
                if text.lower() == target.lower():
                    await lbl.click()
                    await asyncio.sleep(0.3)
                    log.info("Selected radio '%s' for '%s'", text, field.label)
                    return True
            # Second pass: partial/contains match
            for lbl in labels:
                text = (await lbl.text_content() or "").strip()
                if target.lower() in text.lower() or text.lower() in target.lower():
                    await lbl.click()
                    await asyncio.sleep(0.3)
                    log.info("Selected radio '%s' (partial) for '%s'", text, field.label)
                    return True

        # Strategy 2: Find radio by value attribute directly
        radios = []
        if el:
            radios = await el.query_selector_all("input[type='radio']")
        for radio in radios:
            radio_id = await radio.get_attribute("id")
            if radio_id:
                lbl = await page.query_selector(f"label[for='{radio_id}']")
                if lbl:
                    text = (await lbl.text_content() or "").strip()
                    if text.lower() == target.lower():
                        await lbl.click()
                        await asyncio.sleep(0.3)
                        log.info("Selected radio '%s' for '%s' (by id)", text, field.label)
                        return True

        # Strategy 3: Try clicking the radio input directly based on value
        for radio in radios:
            val = (await radio.get_attribute("value") or "").strip()
            if val.lower() == target.lower():
                await radio.click(force=True)
                await asyncio.sleep(0.3)
                log.info("Clicked radio value='%s' for '%s'", val, field.label)
                return True

        log.warning("Could not find radio option '%s' for field '%s'", target, field.label)
    except Exception as e:
        log.warning("Error clicking radio option: %s", e)
    return False


async def _fill_checkbox(page: Page, field: FormField, config: HunterConfig) -> bool:
    """Fill a checkbox (typically agreement/acknowledgment or checkbox group)."""
    is_checked = await field.element.is_checked()

    # For labeled checkbox groups (like PRONOUNS), try to match via patterns
    label_lower = field.label.lower()
    if any(kw in label_lower for kw in ["pronoun", "gender", "race", "ethnicit", "veteran", "disabilit"]):
        # Try to find the right checkbox in the group via multi-option matching
        target = match_multi_option(field.label, field.options) if field.options else None
        if not target:
            # Default: "prefer not to answer" type option
            target = "prefer not to answer"

        try:
            parent = await field.element.evaluate_handle(
                "el => el.closest('fieldset') || el.closest('[data-test-form-builder-checkbox-form-component]') || el.parentElement.parentElement.parentElement"
            )
            el = parent.as_element()
            if el:
                labels = await el.query_selector_all("label")
                for lbl in labels:
                    text = (await lbl.text_content() or "").strip()
                    if target.lower() in text.lower() or text.lower() in target.lower():
                        # Check if the associated checkbox is already checked
                        cb = await lbl.query_selector("input[type='checkbox']")
                        if cb:
                            already_checked = await cb.is_checked()
                            if not already_checked:
                                await lbl.click()
                                await asyncio.sleep(0.3)
                                log.info("Checked checkbox '%s' for '%s'", text, field.label)
                        else:
                            await lbl.click()
                            await asyncio.sleep(0.3)
                            log.info("Clicked checkbox label '%s' for '%s'", text, field.label)
                        return True
        except Exception as e:
            log.warning("Error filling checkbox group '%s': %s", field.label, e)

    # Simple required checkbox (agreement/acknowledgment) — just check it
    if not is_checked and field.required:
        await field.element.check()
        log.info("Checked checkbox '%s'", field.label)
    return True


async def _fill_file_upload(field: FormField, config: HunterConfig) -> bool:
    """Upload resume PDF."""
    resume_path = Path(config.profile.resume_path)
    if not resume_path.is_absolute():
        resume_path = get_project_root() / resume_path

    if not resume_path.exists():
        log.warning("Resume file not found: %s", resume_path)
        return False

    await field.element.set_input_files(str(resume_path))
    log.info("Uploaded resume: %s", resume_path.name)
    return True
